import os from "os";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { mutate, read, getEdit, newId } from "./db";
import { UPLOAD_DIR, filePath, friendlyDiskError } from "./files";
import type { EditJob, EditSlot, SubFont } from "./types";
import { planSlot, voiceReady } from "./plan";

/** Los videos del editor se borran solos a los 30 días (los clips, apenas el video queda listo). */
export const RETENTION_DAYS = 30;

let cachedBin: string | null = null;

export function ffmpegBin(): string {
  if (cachedBin) return cachedBin;
  const tries: string[] = [];
  if (process.env.FFMPEG_PATH) tries.push(process.env.FFMPEG_PATH);
  // El programa que instala "npm install" (ruta directa, no depende del empaquetador de Next)
  const exe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  tries.push(path.join(process.cwd(), "node_modules", "ffmpeg-static", exe));
  // Si ya tienes ffmpeg instalado en tu Mac (Homebrew), también sirve
  if (!process.env.FFMPEG_NO_SYSTEM) tries.push("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg");
  for (const t of tries) {
    try {
      if (fs.existsSync(t)) {
        try {
          fs.chmodSync(t, 0o755);
        } catch {}
        cachedBin = t;
        return t;
      }
    } catch {}
  }
  return "ffmpeg";
}

/** null si todo está bien; si no, un mensaje claro de qué hacer. */
export async function ffmpegProblem(): Promise<string | null> {
  const r = await run(["-hide_banner", "-version"]);
  if (r.code === 0 && /ffmpeg version/i.test(r.err + "")) return null;
  const out = await new Promise<string>((resolve) => {
    const p = spawn(ffmpegBin(), ["-version"], { stdio: ["ignore", "pipe", "pipe"] });
    let t = "";
    p.stdout.on("data", (d) => (t += d));
    p.on("error", () => resolve("ERR"));
    p.on("close", () => resolve(t));
  });
  if (/ffmpeg version/i.test(out)) return null;
  return "Falta instalar el programa que lee y une los videos (ffmpeg). Abre la terminal en la carpeta de la app, escribe npm install, espera a que termine y vuelve a iniciar la app (npm run dev).";
}

export function expiresAt(job: EditJob) {
  return new Date(new Date(job.createdAt).getTime() + RETENTION_DAYS * 86400000);
}

function removeFile(name?: string) {
  if (!name) return;
  try {
    fs.unlinkSync(filePath(name));
  } catch {}
}

export function deleteEditFiles(job: EditJob) {
  job.slots.forEach((s) => {
    removeFile(s.clip);
    removeFile(s.voice);
  });
  removeFile(job.output);
}

/** Borra los montajes con más de 30 días (video final y lo que quede). */
export function purgeOldEdits() {
  const limit = Date.now() - RETENTION_DAYS * 86400000;
  const old = read((db) => db.edits.filter((e) => new Date(e.createdAt).getTime() < limit));
  if (!old.length) return;
  old.forEach(deleteEditFiles);
  mutate((db) => {
    db.edits = db.edits.filter((e) => new Date(e.createdAt).getTime() >= limit);
  });
}

export function run(args: string[], onStderr?: (line: string) => void): Promise<{ code: number; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(ffmpegBin(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let head = "";
    let tail = "";
    p.stderr.on("data", (d) => {
      const t = d.toString();
      if (head.length < 6000) head += t.slice(0, 6000 - head.length);
      tail = (tail + t).slice(-3000);
      onStderr?.(t);
    });
    p.stdout.on("data", (d) => onStderr?.(d.toString()));
    p.on("error", (e) => resolve({ code: 1, err: String(e) }));
    p.on("close", (code) => resolve({ code: code ?? 1, err: head.length < 6000 ? head : head + "\n…\n" + tail }));
  });
}

/** Duración y si trae audio, leyendo lo que imprime ffmpeg. */
export async function probe(file: string): Promise<{ seconds: number; hasAudio: boolean; raw: string }> {
  const { err } = await run(["-hide_banner", "-i", file]);
  const m = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const seconds = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
  return { seconds, hasAudio: /Stream #\d+:\d+.*Audio:/.test(err), raw: err };
}

// ---------- Detección de voz (recorte inteligente) ----------
/** Dónde empieza y termina de hablarse en el clip, según el audio. null si no hay voz. */
export async function speechWindow(file: string, seconds: number): Promise<{ start: number; end: number } | null> {
  const { err } = await run(["-hide_banner", "-i", file, "-vn", "-af", "silencedetect=noise=-32dB:d=0.2", "-f", "null", "-"]);
  const starts = [...err.matchAll(/silence_start:\s*(-?\d+(?:\.\d+)?)/g)].map((m) => Math.max(0, Number(m[1])));
  const ends = [...err.matchAll(/silence_end:\s*(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  // intervalos de silencio; si el último no cierra, llega hasta el final
  const gaps = starts.map((st, i) => ({ s: st, e: ends[i] ?? seconds }));
  let start = 0;
  let end = seconds;
  if (gaps.length && gaps[0].s < 0.08) start = gaps[0].e;
  const last = gaps[gaps.length - 1];
  if (last && last.e >= seconds - 0.08 && last.s > start) end = last.s;
  if (end - start < 0.4) return null;
  return { start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 };
}

/** Completa la detección de voz en los clips que aún no se analizaron (por ejemplo, subidos antes). */
export async function ensureSpeech(job: EditJob) {
  const todo = job.slots.filter((s) => s.clip && s.hasAudio && !s.speechChecked);
  for (const s of todo) {
    let w: { start: number; end: number } | null = null;
    try {
      w = await speechWindow(filePath(s.clip!), s.clipSeconds || 0);
    } catch {}
    mutate((db) => {
      const x = db.edits.find((e) => e.id === job.id)?.slots.find((q) => q.id === s.id);
      if (x) {
        x.speechChecked = true;
        x.speechStart = w?.start;
        x.speechEnd = w?.end;
      }
    });
    s.speechChecked = true;
    s.speechStart = w?.start;
    s.speechEnd = w?.end;
  }
}

// ---------- Subtítulos ----------
export interface FontCfg {
  label: string;
  file: string;
  size: number;
  upper: boolean;
}
/** Las tipografías viajan dentro de la app (public/fonts): se ven igual en cualquier computador. */
export const FONTS: Record<SubFont, FontCfg> = {
  montserrat: { label: "Montserrat", file: "montserrat.woff", size: 56, upper: false },
  poppins: { label: "Poppins", file: "poppins.woff", size: 58, upper: false },
  bebas: { label: "Bebas Neue", file: "bebas.woff", size: 80, upper: true },
  anton: { label: "Anton", file: "anton.woff", size: 70, upper: true },
  lilita: { label: "Lilita One", file: "lilita.woff", size: 64, upper: false },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fontCache = new Map<string, any>();
async function loadFont(id: SubFont) {
  const cfg = FONTS[id] ?? FONTS.montserrat;
  if (fontCache.has(cfg.file)) return fontCache.get(cfg.file);
  const opentype = (await import("opentype.js")).default ?? (await import("opentype.js"));
  const buf = fs.readFileSync(path.join(process.cwd(), "public", "fonts", cfg.file));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  fontCache.set(cfg.file, font);
  return font;
}

/** Parte el texto de una toma en frases cortas (máx. 5 palabras y ~24 letras), como en TikTok. */
export function chunkText(text: string): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const out: string[] = [];
  let cur: string[] = [];
  for (const w of words) {
    const next = [...cur, w].join(" ");
    if (cur.length && (cur.length >= 5 || next.length > 24)) {
      out.push(cur.join(" "));
      cur = [w];
    } else cur.push(w);
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
}

/** Convierte los trazos de la letra a texto SVG. (toPathData de opentype.js a veces escribe "NaN" y la letra queda cortada.) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pathData(cmds: any[]): string {
  const n = (v: number) => (Number.isFinite(v) ? (Math.round(v * 100) / 100).toString() : "0");
  return cmds
    .map((c) => {
      switch (c.type) {
        case "M":
        case "L":
          return `${c.type}${n(c.x)} ${n(c.y)}`;
        case "C":
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        case "Q":
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case "Z":
          return "Z";
        default:
          return "";
      }
    })
    .join("");
}

/** Dibuja la frase como trazos (no depende de las fuentes del computador) y la guarda como PNG transparente. */
export async function subtitlePng(text: string, fontId: SubFont, color: "blanco" | "amarillo" | "caja" | "cajablanca", out: string) {
  const sharp = (await import("sharp")).default;
  const cfg = FONTS[fontId] ?? FONTS.montserrat;
  const font = await loadFont(fontId);
  const t = cfg.upper ? text.toUpperCase() : text;
  let size = cfg.size;
  let w = font.getAdvanceWidth(t, size);
  if (w > 860) {
    size = (size * 860) / w;
    w = font.getAdvanceWidth(t, size);
  }
  const H = 260;
  const baseline = H / 2 + size * 0.34;
  const d = pathData(font.getPath(t, (1080 - w) / 2, baseline, size).commands);
  const fill = color === "amarillo" ? "#FFE14A" : "#FFFFFF";
  if (color === "caja" || color === "cajablanca") {
    const white = color === "cajablanca";
    // Recuadro centrado sobre las letras: arriba y abajo el mismo aire, aunque cambie la fuente o haya tildes
    const bb = font.getPath(t, 0, baseline, size).getBoundingBox();
    const top = Math.min(Number.isFinite(bb.y1) ? bb.y1 : baseline - size * 0.72, baseline - size * 0.72);
    const bottom = Math.max(Number.isFinite(bb.y2) ? bb.y2 : baseline, baseline);
    const padX = size * 0.5, padY = size * 0.3, y0 = top - padY, boxH = bottom - top + padY * 2;
    const box = `<rect x="${((1080 - w) / 2 - padX).toFixed(1)}" y="${y0.toFixed(1)}" width="${(w + padX * 2).toFixed(1)}" height="${boxH.toFixed(1)}" rx="${(size * 0.25).toFixed(1)}" fill="${white ? "#FFFFFF" : "#000"}" fill-opacity="${white ? "1" : "0.62"}"/>`;
    const svgBox = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${H}">${box}<path d="${d}" fill="${white ? "#000000" : "#FFFFFF"}"/></svg>`;
    await sharp(Buffer.from(svgBox)).png().toFile(out);
    return;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${H}"><path d="${d}" fill="#000" stroke="#000" stroke-width="${(size * 0.2).toFixed(1)}" stroke-linejoin="round"/><path d="${d}" fill="${fill}"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(out);
}

/** Texto que pone la persona sobre la toma: varias líneas, centrado, con el mismo estilo y fuente de los subtítulos. */
export async function overlayPng(text: string, fontId: SubFont, color: "blanco" | "amarillo" | "caja" | "cajablanca", out: string): Promise<number> {
  const sharp = (await import("sharp")).default;
  const cfg = FONTS[fontId] ?? FONTS.montserrat;
  const font = await loadFont(fontId);
  const t = (cfg.upper ? text.toUpperCase() : text).replace(/\s+/g, " ").trim();
  const maxW = 900;
  let size = Math.round(cfg.size * 0.9);
  const wrap = (sz: number) => {
    const lines: string[] = [];
    let cur = "";
    for (const w of t.split(" ")) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && font.getAdvanceWidth(next, sz) > maxW) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  let lines = wrap(size);
  while (lines.length > 4 && size > 30) {
    size -= 4;
    lines = wrap(size);
  }
  const lh = size * 1.25;
  const pad = size * 0.5;
  const H = Math.ceil(lines.length * lh + pad * 2);
  const fill = color === "amarillo" ? "#FFE14A" : color === "cajablanca" ? "#000000" : "#FFFFFF";
  const boxed = color === "caja" || color === "cajablanca";
  let shapes = "";
  let boxW = 0;
  const widths = lines.map((l) => font.getAdvanceWidth(l, size));
  boxW = Math.max(...widths);
  if (boxed) shapes += `<rect x="${((1080 - boxW) / 2 - pad).toFixed(1)}" y="0" width="${(boxW + pad * 2).toFixed(1)}" height="${H}" rx="${(size * 0.25).toFixed(1)}" fill="${color === "cajablanca" ? "#FFFFFF" : "#000"}" fill-opacity="${color === "cajablanca" ? "1" : "0.62"}"/>`;
  lines.forEach((l, k) => {
    const base = pad + k * lh + size * 0.9;
    const d = pathData(font.getPath(l, (1080 - widths[k]) / 2, base, size).commands);
    if (!boxed) shapes += `<path d="${d}" fill="#000" stroke="#000" stroke-width="${(size * 0.2).toFixed(1)}" stroke-linejoin="round"/>`;
    shapes += `<path d="${d}" fill="${fill}"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${H}">${shapes}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(out);
  return H;
}

/** Cuándo se dice cada frase dentro de la voz: se reparte según el largo de cada frase. */
export function timeChunks(text: string, from: number, to: number): { text: string; from: number; to: number }[] {
  const chunks = chunkText(text);
  if (!chunks.length) return [];
  const totalChars = chunks.reduce((a, c) => a + c.length, 0);
  const window = Math.max(0.6, to - from);
  let t = from;
  return chunks.map((c) => {
    const d = (c.length / totalChars) * window;
    const item = { text: c, from: t, to: t + d };
    t += d;
    return item;
  });
}

function patch(id: string, fn: (j: EditJob) => void) {
  mutate((db) => {
    const j = db.edits.find((e) => e.id === id);
    if (j) fn(j);
  });
}

/**
 * Antes de unir el video se revisa que cada toma tenga la voz de SU texto actual.
 * Si cambiaste un texto (por ejemplo, pasaste una frase de la toma 8 a la 7), la voz vieja ya no sirve:
 * se vuelve a crear aquí mismo, sin depender de que el navegador lo haya pedido antes.
 */
async function ensureVoices(id: string) {
  const job = getEdit(id);
  if (!job || job.kind !== "broll" || job.voiceOn !== true) return;
  const { synthesize, clampSpeed } = await import("./voice");
  const voiceName = job.voiceName ?? "Kore";
  const speed = clampSpeed(job.voiceSpeed);
  const stale = (s: EditSlot) => !!s.clip && !!s.text.trim() && (!voiceReady(s) || s.voiceName !== voiceName || Math.abs((s.voiceSpeed ?? 1) - speed) > 0.01);
  let lastErr = "";
  for (let round = 0; round < 3; round++) {
    const todo = (getEdit(id)?.slots ?? []).filter(stale);
    if (!todo.length) return;
    patch(id, (j) => {
      j.stage = `Creando las voces (${todo.length})`;
      j.progress = 3;
    });
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const s = todo[next++];
        const text = s.text.trim();
        try {
          const r = await synthesize(text, voiceName, speed);
          let old: string | undefined;
          mutate((db) => {
            const x = db.edits.find((e) => e.id === id)?.slots.find((q) => q.id === s.id);
            if (!x) return;
            old = x.voice;
            x.voice = r.file;
            x.voiceSeconds = r.seconds;
            x.voiceText = text;
            x.voiceName = voiceName;
            x.voiceSpeed = speed;
          });
          removeFile(old);
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }
  const left = (getEdit(id)?.slots ?? []).map((s, i) => (stale(s) ? i + 1 : 0)).filter(Boolean);
  if (left.length) throw new Error(`No se pudo crear la voz de la toma ${left.join(", ")}. ${lastErr}`.slice(0, 400));
}

/** Resume el error de ffmpeg: busca la línea que dice qué falló (no el resumen de salida que imprime al final). */
function ffmpegReason(err: string): string {
  const lines = err.split("\n").map((l) => l.trim()).filter(Boolean);
  const bad = lines.filter((l) => /error|invalid|no such|unable|failed|cannot|could not|killed|not found|denied/i.test(l) && !/^(Stream|Metadata|encoder)/i.test(l));
  const pick = (bad.length ? bad.slice(0, 3) : lines.slice(-3)).join(" ");
  return (lines.length && !bad.length ? "Posible falta de memoria del servidor. " : "") + pick.slice(0, 300);
}

/** Une los clips en orden (vertical 1080x1920), recortados a lo que se dice, y pone los subtítulos. */
export async function renderEdit(id: string) {
  const job0 = getEdit(id);
  if (!job0) return;
  const tmp = path.join(os.tmpdir(), `adscaler-${newId()}`);
  try {
    await ensureSpeech(job0);
    await ensureVoices(id);
    const job = getEdit(id)!;
    const kind = job.kind ?? "ugc";
    const smart = job.smartTrim !== false;
    const slots = job.slots.filter((s) => s.clip);
    if (!slots.length) throw new Error("Sube al menos un clip.");
    fs.mkdirSync(tmp, { recursive: true });

    patch(id, (j) => {
      j.stage = "Preparando los clips";
      j.progress = 2;
    });
    const voiceOn = kind === "broll" && job.voiceOn === true;
    const plans = slots.map((s: EditSlot) => planSlot(kind, smart, s, voiceOn));
    const total = plans.reduce((a, p) => a + p.dur, 0);
    const n = slots.length;

    // Cada toma se arma por separado (poca memoria) y al final se unen sin volver a codificar el video.
    // Antes se armaba todo en un solo comando con todos los clips abiertos a la vez y el servidor se quedaba sin memoria.
    const clipFiles: string[] = [];
    for (let i = 0; i < n; i++) {
      const s = slots[i];
      const p = plans[i];
      patch(id, (j) => {
        j.stage = `Armando la toma ${i + 1} de ${n}`;
        j.progress = Math.max(j.progress ?? 0, 5 + Math.round((i / n) * 85));
      });
      const a: string[] = ["-hide_banner", "-y", "-threads", "2", "-ss", p.start.toFixed(2), "-t", Math.max(0.1, p.dur - p.hold).toFixed(2), "-i", filePath(s.clip!)];
      let voiceIn = -1;
      let nIn = 1;
      if (p.voice && s.voice) {
        voiceIn = nIn++;
        a.push("-threads", "1", "-i", filePath(s.voice));
      }
      const filters: string[] = [];
      const hold = p.hold > 0 ? `,tpad=stop_mode=clone:stop_duration=${p.hold.toFixed(2)}` : "";
      filters.push(`[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30${hold},format=yuv420p[v0]`);
      const fade = p.dur > 0.4 ? `,afade=t=out:st=${(p.dur - 0.05).toFixed(2)}:d=0.05` : "";
      const pad = `,apad=whole_dur=${p.dur.toFixed(3)},atrim=0:${p.dur.toFixed(3)},asetpts=PTS-STARTPTS`;
      if (voiceIn >= 0) filters.push(`[${voiceIn}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo${pad}${fade}[a0]`);
      else if (s.hasAudio && !voiceOn) filters.push(`[0:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo${pad}${fade}[a0]`);
      else filters.push(`anullsrc=r=44100:cl=stereo,atrim=0:${p.dur.toFixed(3)},asetpts=PTS-STARTPTS[a0]`);

      // Subtítulos de esta toma (tiempos desde el inicio de la toma)
      let vlabel = "v0";
      if (job.subtitles) {
        const chunks = timeChunks(s.text, p.speechFrom, p.speechTo);
        for (let k = 0; k < chunks.length; k++) {
          const png = path.join(tmp, `s${i}_${k}.png`);
          await subtitlePng(chunks[k].text, job.subFont ?? "montserrat", job.subStyle, png);
          a.push("-threads", "1", "-i", png);
          const idx = nIn++;
          const next = `o${k}`;
          filters.push(`[${vlabel}][${idx}:v]overlay=0:1230:enable='between(t,${chunks[k].from.toFixed(2)},${chunks[k].to.toFixed(2)})'[${next}]`);
          vlabel = next;
        }
      }
      // Texto que puso la persona (dura toda la toma)
      const ot = (s.overlayText ?? "").trim();
      if (ot) {
        const png = path.join(tmp, `t${i}.png`);
        const h = await overlayPng(ot, job.subFont ?? "montserrat", job.subStyle, png);
        a.push("-threads", "1", "-i", png);
        const idx = nIn++;
        const y = s.overlayPos === "centro" ? Math.round((1920 - h) / 2) : s.overlayPos === "abajo" ? 1580 - h : 260;
        filters.push(`[${vlabel}][${idx}:v]overlay=0:${y}[ot]`);
        vlabel = "ot";
      }
      const out = path.join(tmp, `c${i}.mp4`);
      a.push(
        "-filter_complex", filters.join(";"),
        "-map", `[${vlabel}]`, "-map", "[a0]",
        "-filter_threads", "2", "-filter_complex_threads", "2",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-r", "30",
        "-threads", "3",
        "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2",
        "-t", p.dur.toFixed(3),
        out
      );
      let r = await run(a);
      // Si el servidor se queda sin hilos, se reintenta con 1 hilo por todo
      if (r.code !== 0 && /Resource temporarily unavailable/i.test(r.err)) {
        const slow = a.map((x, q) => (/^(-threads|-filter_threads|-filter_complex_threads)$/.test(a[q - 1] ?? "") ? "1" : x));
        r = await run(slow);
      }
      if (r.code !== 0 || !fs.existsSync(out)) throw new Error(`No se pudo armar la toma ${i + 1}. ${ffmpegReason(r.err)}`);
      clipFiles.push(out);
    }

    patch(id, (j) => {
      j.stage = "Uniendo las tomas";
      j.progress = 92;
    });
    const list = path.join(tmp, "list.txt");
    fs.writeFileSync(list, clipFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    const outName = `${newId()}.mp4`;
    const j = await run([
      "-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", list,
      "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2",
      "-movflags", "+faststart",
      filePath(outName),
    ]);
    if (j.code !== 0) throw new Error(`No se pudieron unir las tomas. ${ffmpegReason(j.err)}`);

    const old = getEdit(id)?.output;
    // Para ahorrar espacio, los clips subidos se borran apenas el video final está listo
    const clipsToRemove = (getEdit(id)?.slots ?? []).map((s) => s.clip);
    patch(id, (j) => {
      j.slots.forEach((s) => {
        s.clip = undefined;
        s.clipName = undefined;
        s.clipSeconds = undefined;
        s.hasAudio = undefined;
        s.speechStart = undefined;
        s.speechEnd = undefined;
        s.speechChecked = undefined;
      });
      j.status = "done";
      j.stage = undefined;
      j.progress = 100;
      j.output = outName;
      j.outputSeconds = Math.round(total * 10) / 10;
      j.error = undefined;
    });
    removeFile(old);
    clipsToRemove.forEach(removeFile);
  } catch (e) {
    patch(id, (j) => {
      j.status = "error";
      j.error = friendlyDiskError(e instanceof Error ? e.message : String(e));
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}


/* ---------------- Cola de armado de videos ---------------- */
// Armar un video usa mucha memoria y procesador. Para que el servidor no se caiga cuando hay mucha gente,
// se arman pocos a la vez (RENDER_CONCURRENCY, por defecto 2) y los demás esperan su turno.
const MAX_RENDERS = Math.max(1, Number(process.env.RENDER_CONCURRENCY) || 2);
const running = new Set<string>();
const waiting: string[] = [];

function refreshQueue() {
  waiting.forEach((jid, i) => {
    patch(jid, (j) => {
      j.queued = running.size + i;
      j.progress = 0;
      j.stage = "En cola";
    });
  });
}

function pump() {
  while (running.size < MAX_RENDERS && waiting.length) {
    const id = waiting.shift()!;
    running.add(id);
    patch(id, (j) => {
      j.queued = 0;
      j.stage = undefined;
      j.renderStartedAt = new Date().toISOString();
    });
    refreshQueue();
    renderEdit(id)
      .catch(() => {})
      .finally(() => {
        running.delete(id);
        pump();
      });
  }
}

/** Pone un video en la cola. Si hay lugar, empieza de inmediato. */
export function enqueueRender(id: string) {
  if (running.has(id) || waiting.includes(id)) return;
  waiting.push(id);
  refreshQueue();
  pump();
}

/** Al arrancar el servidor: los videos que se estaban armando se perdieron; se avisa para volver a intentarlo. */
export function resetStuckRenders() {
  try {
    mutate((db) => {
      db.edits.forEach((e) => {
        if (e.status === "rendering") {
          e.status = "error";
          e.queued = undefined;
          e.stage = undefined;
          e.error = "El servidor se reinició mientras se armaba tu video. Aprieta «Crear video» otra vez (tus clips siguen subidos).";
        }
      });
    });
  } catch {}
}
