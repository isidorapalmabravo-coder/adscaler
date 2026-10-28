"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EditJob, EditKind, EditSlot, SubFont } from "@/lib/types";
import { planSlot, voiceReady } from "@/lib/plan";
import { VOICES, DEFAULT_VOICE } from "@/lib/voice-list";

const url = (name: string) => `/api/files/${name}`;
const rid = () => Math.random().toString(36).slice(2, 10);
const sec = (n: number) => `${(Math.round(n * 10) / 10).toString().replace(".", ",")} s`;
/** Número de toma que dice el nombre del archivo: "toma3.mp4", "Toma 03 - hook.mov", "3.mp4", "clip_12.mp4". Devuelve 0 si no tiene número. */
function tomaNumber(name: string): number {
  const base = name.replace(/\.[a-z0-9]+$/i, "");
  const m = base.match(/(?:toma|take|shot|escena|clip|t)[\s._-]*0*(\d{1,3})(?!\d)/i) ?? base.match(/(?:^|[^\d])0*(\d{1,3})(?!\d)(?!.*\d)/);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 60 ? n : 0;
}
const natural = (a: File, b: File) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

const FONT_OPTS: { id: SubFont; label: string; upper?: boolean }[] = [
  { id: "montserrat", label: "Montserrat" },
  { id: "poppins", label: "Poppins" },
  { id: "bebas", label: "Bebas Neue", upper: true },
  { id: "anton", label: "Anton", upper: true },
  { id: "lilita", label: "Lilita One" },
];
const FONT_CSS = FONT_OPTS.map((f) => `@font-face{font-family:"sub-${f.id}";src:url(/fonts/${f.id}.woff) format("woff");font-display:swap}`).join("");

type Prog = Record<string, number>; // slotId -> % subiendo

// Mide la duración con el propio navegador (no depende de ffmpeg)
function readSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const u = URL.createObjectURL(file);
    const done = (n: number) => {
      URL.revokeObjectURL(u);
      resolve(n);
    };
    v.preload = "metadata";
    v.onloadedmetadata = () => done(isFinite(v.duration) ? v.duration : 0);
    v.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    v.src = u;
  });
}

function uploadClip(jobId: string, slotId: string, file: File, onProgress: (p: number) => void): Promise<EditJob> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", `/api/editor/${jobId}/clip`);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    x.onload = () => {
      try {
        const j = JSON.parse(x.responseText);
        if (x.status >= 200 && x.status < 300) resolve(j as EditJob);
        else reject(new Error((j.error || "No se pudo subir el clip.") + (j.detail ? ` (${j.detail})` : "")));
      } catch {
        reject(new Error("No se pudo subir el clip."));
      }
    };
    x.onerror = () => reject(new Error("Se cortó la conexión al subir el clip."));
    const f = new FormData();
    f.append("slot", slotId);
    readSeconds(file).then((sec) => {
      f.append("seconds", String(sec));
      f.append("file", file);
      x.send(f);
    });
  });
}

function etaText(j: EditJob) {
  const pct = j.progress ?? 0;
  const started = j.renderStartedAt ? new Date(j.renderStartedAt).getTime() : 0;
  if (!started) return "Calculando el tiempo…";
  const el = (Date.now() - started) / 1000;
  if (pct < 12 || el < 6) return "Calculando el tiempo que falta…";
  const left = Math.max(1, Math.round((el / pct) * (100 - pct)));
  return left >= 60 ? `Faltan unos ${Math.ceil(left / 60)} min` : `Faltan unos ${left} s`;
}

export function EditorClient({ initial, expires }: { initial: EditJob; expires: string }) {
  const router = useRouter();
  const [job, setJob] = useState<EditJob>(initial);
  const [slots, setSlots] = useState<EditSlot[]>(initial.slots);
  const [title, setTitle] = useState(initial.title);
  const [subtitles, setSubtitles] = useState(initial.subtitles);
  const [subStyle, setSubStyle] = useState(initial.subStyle);
  const [subFont, setSubFont] = useState<SubFont>(initial.subFont ?? "montserrat");
  const [kind, setKind] = useState<EditKind>(initial.kind ?? "ugc");
  const [smartTrim, setSmartTrim] = useState(initial.smartTrim !== false);
  const [voiceOn, setVoiceOn] = useState(initial.voiceOn !== false);
  const [voiceName, setVoiceName] = useState(initial.voiceName ?? DEFAULT_VOICE);
  const [voiceBusy, setVoiceBusy] = useState("");
  const [voiceSpeed, setVoiceSpeed] = useState<number>(initial.voiceSpeed ?? 1.25);
  const [sample, setSample] = useState("");
  const [prog, setProg] = useState<Prog>({});
  const [msg, setMsg] = useState("");
  const [over, setOver] = useState(false);
  const dirty = useRef(false);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef({ slots, title, subtitles, subStyle, subFont, kind, smartTrim, voiceOn, voiceName, voiceSpeed });
  latest.current = { slots, title, subtitles, subStyle, subFont, kind, smartTrim, voiceOn, voiceName, voiceSpeed };

  const save = useCallback(() => {
    saving.current = saving.current.then(async () => {
      const { slots, title, subtitles, subStyle, subFont, kind, smartTrim, voiceOn, voiceName, voiceSpeed } = latest.current;
      dirty.current = false;
      await fetch(`/api/editor/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subtitles, subStyle, subFont, kind, smartTrim, voiceOn, voiceName, voiceSpeed, slots: slots.map((s) => ({ id: s.id, text: s.text, manualSeconds: s.manualSeconds ?? null, overlayText: s.overlayText ?? "", overlayPos: s.overlayPos ?? "arriba" })) }),
      }).catch(() => {});
    });
    return saving.current;
  }, [initial.id]);

  // Guarda solo, medio segundo después del último cambio
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(save, 600);
    return () => clearTimeout(t);
  }, [slots, title, subtitles, subStyle, subFont, kind, smartTrim, voiceOn, voiceName, voiceSpeed, save]);

  const change = <T,>(set: (v: T) => void) => (v: T) => {
    dirty.current = true;
    set(v);
  };

  const mergeClip = (j: EditJob) =>
    setSlots((cur) =>
      cur.map((s) => {
        const n = j.slots.find((x) => x.id === s.id);
        return n ? { ...s, clip: n.clip, clipName: n.clipName, clipSeconds: n.clipSeconds, hasAudio: n.hasAudio, speechStart: n.speechStart, speechEnd: n.speechEnd, speechChecked: n.speechChecked, manualSeconds: n.manualSeconds } : s;
      })
    );

  const mergeVoice = (j: EditJob) =>
    setSlots((cur) =>
      cur.map((s) => {
        const n = j.slots.find((x) => x.id === s.id);
        return n ? { ...s, voice: n.voice, voiceSeconds: n.voiceSeconds, voiceText: n.voiceText, voiceName: n.voiceName, voiceSpeed: n.voiceSpeed } : s;
      })
    );

  // ---------- Voz en off ----------
  async function callVoice(body: Record<string, unknown>, busy: string) {
    setMsg("");
    setVoiceBusy(busy);
    try {
      await save();
      const r = await fetch(`/api/editor/${initial.id}/voice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceName, speed: voiceSpeed, ...body }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "No se pudo crear la voz.");
      return j as { file?: string; job?: EditJob; failed?: number };
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo crear la voz.");
      return null;
    } finally {
      setVoiceBusy("");
    }
  }
  async function makeVoices(force = false) {
    const j = await callVoice({ force }, "all");
    if (j?.job) {
      mergeVoice(j.job);
      if (j.failed) setMsg(`${j.failed} toma(s) no se pudieron crear. Vuelve a apretar el botón para reintentar.`);
    }
    return j;
  }
  async function makeOne(id: string) {
    const j = await callVoice({ slotId: id }, id);
    if (j?.job) mergeVoice(j.job);
  }
  async function trySample() {
    const j = await callVoice({ sample: true }, "sample");
    if (j?.file) setSample(j.file + "?" + Date.now());
  }

  // ---------- Subir clips ----------
  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => /\.(mp4|mov|m4v|webm)$/i.test(f.name)).sort(natural);
    if (!files.length) {
      setMsg("Sube videos MP4 o MOV.");
      return;
    }
    setMsg("");
    // 1) a qué toma va cada clip. Si el nombre trae número (toma3, 3.mp4, clip_03), va a ESA toma; si no, a la
    //    primera toma vacía en orden de nombre. Si faltan tomas, se crean.
    const next = [...latest.current.slots];
    const targets: { slot: string; file: File }[] = [];
    const taken = new Set<string>();
    const ensure = (idx: number) => {
      while (next.length <= idx) next.push({ id: rid(), text: "" });
      return next[idx];
    };
    const numbered = files.filter((f) => tomaNumber(f.name) > 0).sort((a, b) => tomaNumber(a.name) - tomaNumber(b.name) || natural(a, b));
    const plain = files.filter((f) => tomaNumber(f.name) === 0);
    const placed = new Set<File>();
    for (const f of numbered) {
      const idx = tomaNumber(f.name) - 1;
      const slot = ensure(idx);
      if (taken.has(slot.id)) continue; // dos archivos con el mismo número: el segundo va después como "sin número"
      taken.add(slot.id);
      targets.push({ slot: slot.id, file: f });
      placed.add(f);
    }
    for (const f of [...plain, ...numbered.filter((x) => !placed.has(x))]) {
      let idx = next.findIndex((s2) => !s2.clip && !taken.has(s2.id));
      if (idx < 0) {
        next.push({ id: rid(), text: "" });
        idx = next.length - 1;
      }
      taken.add(next[idx].id);
      targets.push({ slot: next[idx].id, file: f });
    }
    dirty.current = true;
    setSlots(next);
    latest.current = { ...latest.current, slots: next };
    await save();
    // 2) subir de a dos clips a la vez
    const queue = [...targets];
    const worker = async () => {
      while (queue.length) {
        const t = queue.shift()!;
        try {
          setProg((p) => ({ ...p, [t.slot]: 1 }));
          const j = await uploadClip(initial.id, t.slot, t.file, (pct) => setProg((p) => ({ ...p, [t.slot]: pct })));
          mergeClip(j);
        } catch (e) {
          setMsg(e instanceof Error ? e.message : "Falló una subida.");
        } finally {
          setProg((p) => {
            const c = { ...p };
            delete c[t.slot];
            return c;
          });
        }
      }
    };
    await Promise.all([worker(), worker()]);
    setJob((j) => ({ ...j, status: j.status === "done" ? "draft" : j.status }));
  }

  // Cambia el clip de UNA toma por otro (el anterior se borra en el servidor)
  async function replaceClip(slotId: string, file: File) {
    if (!/\.(mp4|mov|m4v|webm)$/i.test(file.name)) {
      setMsg("Sube un video MP4 o MOV.");
      return;
    }
    setMsg("");
    setProg((p) => ({ ...p, [slotId]: 1 }));
    try {
      await save();
      mergeClip(await uploadClip(initial.id, slotId, file, (pct) => setProg((p) => ({ ...p, [slotId]: pct }))));
      setJob((j) => ({ ...j, status: j.status === "done" ? "draft" : j.status }));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Falló la subida.");
    } finally {
      setProg((p) => {
        const c = { ...p };
        delete c[slotId];
        return c;
      });
    }
  }

  async function removeClip(slotId: string) {
    const r = await fetch(`/api/editor/${initial.id}/clip?slot=${slotId}`, { method: "DELETE" });
    if (r.ok) mergeClip((await r.json()) as EditJob);
  }

  // ---------- Orden de las tomas ----------
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= slots.length) return;
    const a = [...slots];
    [a[i], a[j]] = [a[j], a[i]];
    change(setSlots)(a);
  };
  const addSlot = () => change(setSlots)([...slots, { id: rid(), text: "" }]);
  const dropSlot = async (i: number) => {
    const s = slots[i];
    if (s.clip && !window.confirm("Esta toma tiene un clip subido. ¿Quitarla igual?")) return;
    change(setSlots)(slots.filter((_, k) => k !== i));
  };
  const setManual = (i: number, v: number | undefined) => change(setSlots)(slots.map((s, k) => (k === i ? { ...s, manualSeconds: v } : s)));
  const setOverlay = (i: number, patch: { overlayText?: string; overlayPos?: "arriba" | "centro" | "abajo" }) => change(setSlots)(slots.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const setText = (i: number, text: string) => change(setSlots)(slots.map((s, k) => (k === i ? { ...s, text } : s)));

  // ---------- Crear el video ----------
  const rendering = job.status === "rendering";
  useEffect(() => {
    if (!rendering) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/editor/${initial.id}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as EditJob;
      setJob(j);
      if (j.status !== "rendering") router.refresh();
    }, 2000);
    return () => clearInterval(t);
  }, [rendering, initial.id, router]);

  async function create() {
    setMsg("");
    await save();
    if (kind === "broll" && voiceOn && slots.some((s) => s.clip && s.text.trim() && (!voiceReady(s) || s.voiceName !== voiceName || Math.abs((s.voiceSpeed ?? 1) - voiceSpeed) > 0.01))) {
      let j = await makeVoices();
      // una voz que falla se reintenta una vez más; si sigue fallando, el video se crea igual (esa toma queda sin voz)
      if (j?.job && j.job.slots.some((s) => s.clip && s.text.trim() && !voiceReady(s))) j = await makeVoices();
      if (j?.job && j.job.slots.some((s) => s.clip && s.text.trim() && !voiceReady(s))) {
        setMsg("Una toma no pudo crear su voz: el video se crea igual y esa toma queda sin voz. Puedes crear su voz después y volver a crear el video.");
      }
    }
    const r = await fetch(`/api/editor/${initial.id}/render`, { method: "POST" });
    const j = await r.json();
    if (!r.ok) {
      setMsg(j.error || "No se pudo empezar.");
      return;
    }
    setJob(j);
  }

  async function removeJob() {
    if (!window.confirm("¿Borrar este montaje con todos sus clips?")) return;
    await fetch(`/api/editor/${initial.id}`, { method: "DELETE" });
    router.push("/editor");
  }

  const withClip = slots.filter((s) => s.clip);
  const missing = slots.map((s, i) => (s.clip ? 0 : i + 1)).filter(Boolean);
  const plans = new Map(withClip.map((s) => [s.id, planSlot(kind, smartTrim, s, kind === "broll" && voiceOn)]));
  const total = withClip.reduce((a, s) => a + (plans.get(s.id)?.dur || 0), 0);
  const original = withClip.reduce((a, s) => a + (s.clipSeconds || 0), 0);
  const uploading = Object.keys(prog).length > 0;
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="stack-lg">
      <style>{FONT_CSS}</style>
      <div className="stack" style={{ gap: 8 }}>
        <Link href="/editor" className="muted small" style={{ textDecoration: "none" }}>← Editor de video</Link>
        <div className="row between">
          <input
            value={title}
            onChange={(e) => change(setTitle)(e.target.value)}
            aria-label="Nombre del video"
            style={{ font: "800 30px var(--display)", border: "0", borderBottom: "2px solid transparent", background: "transparent", padding: "2px 0", minWidth: 280, flex: "1 1 300px" }}
            onFocus={(e) => (e.currentTarget.style.borderBottomColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
          />
          <button type="button" className="btn ghost" onClick={removeJob}>Borrar montaje</button>
        </div>
        <span className="muted small">Se guarda solo. Los clips se borran el {expires}.</span>
      </div>

      {/* PASO 1 */}
      <section className="stack" style={{ gap: 14 }}>
        <h2>1 · Sube tus clips de Flow</h2>
        <div
          className="drop"
          role="button"
          tabIndex={0}
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
          style={{ alignItems: "center", textAlign: "center", padding: 28, cursor: "pointer", background: over ? "#E4EAF5" : "#fff", borderColor: over ? "var(--accent)" : "#AEB9CF" }}
        >
          <strong style={{ fontSize: 17 }}>Arrastra aquí todos tus clips, o toca para elegirlos</strong>
          <span className="muted small">Pon el número de la toma en el nombre del archivo (toma1.mp4, toma2.mp4… o 1.mp4, 2.mp4…) y cada clip va a su toma. Si el nombre no tiene número, se acomodan en orden por nombre. Después puedes mover cada uno.</span>
          <input ref={fileInput} type="file" accept="video/mp4,video/quicktime,.mp4,.mov,.m4v" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        </div>
        {msg && <p className="error" role="alert">{msg}</p>}

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
          {slots.map((s, i) => (
            <div key={s.id} className="card stack" style={{ padding: 12, gap: 10 }}>
              <div className="row between" style={{ gap: 6 }}>
                <strong>Toma {i + 1}</strong>
                <span className="row" style={{ gap: 4 }}>
                  <button type="button" className="icon-btn" aria-label={`Mover la toma ${i + 1} antes`} disabled={i === 0} onClick={() => move(i, -1)}>←</button>
                  <button type="button" className="icon-btn" aria-label={`Mover la toma ${i + 1} después`} disabled={i === slots.length - 1} onClick={() => move(i, 1)}>→</button>
                  <button type="button" className="icon-btn" aria-label={`Quitar la toma ${i + 1}`} onClick={() => dropSlot(i)}>✕</button>
                </span>
              </div>

              {s.clip ? (
                <div className="stack" style={{ gap: 6 }}>
                  <video src={url(s.clip)} controls muted playsInline preload="metadata" style={{ width: "100%", aspectRatio: "9 / 16", maxHeight: 320, objectFit: "cover", background: "#000", borderRadius: 4 }} />
                  {(() => {
                    const p = plans.get(s.id)!;
                    const why = p.mode === "audio" ? "según la voz del clip" : p.mode === "guion" ? "según el texto" : p.mode === "manual" ? "largo fijado por ti" : p.mode === "voz" ? "según la voz en off" : "";
                    return (
                      <div className="stack" style={{ gap: 6 }}>
                        {s.clipName && <span className="muted small" style={{ overflowWrap: "anywhere" }} title={s.clipName}>📎 {s.clipName}</span>}
                        <div className="row between small" style={{ gap: 6 }}>
                          <span><strong>Se usa {sec(p.dur)}</strong> <span className="muted">de {sec(s.clipSeconds || 0)}</span></span>
                          <span className="row" style={{ gap: 4 }}>
                            <label className="btn ghost" style={{ minHeight: 28, padding: "2px 6px", cursor: "pointer" }}>
                              Cambiar clip
                              <input type="file" accept="video/mp4,video/quicktime,.mp4,.mov,.m4v" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) replaceClip(s.id, f); }} />
                            </label>
                            <button type="button" className="btn ghost" style={{ minHeight: 28, padding: "2px 6px" }} onClick={() => removeClip(s.id)}>Quitar clip</button>
                          </span>
                        </div>
                        <div className="row small muted" style={{ gap: 6 }}>
                          {why && <span>{p.cut > 0.05 ? `Se corta ${sec(p.cut)} ${why}` : `Dura todo el clip (${why})`}</span>}
                          {!why && <span>{s.hasAudio ? "Se usa completo" : "Sin audio · se usa completo"}</span>}
                        </div>
                        {p.mode === "voz" ? (
                          <span className="small muted">El largo sale de la voz: la toma se corta cuando termina de hablar.</span>
                        ) : (
                        <label className="row small" style={{ gap: 6 }}>
                          <span className="muted">Largo:</span>
                          <input
                            type="number"
                            min={0.5}
                            max={s.clipSeconds || 10}
                            step={0.1}
                            value={s.manualSeconds ?? p.dur}
                            onChange={(e) => setManual(i, e.target.value ? Number(e.target.value) : undefined)}
                            style={{ width: 70, padding: "4px 6px", border: "1px solid var(--line)", borderRadius: 4, font: "inherit" }}
                            aria-label={`Largo que se usa de la toma ${i + 1}, en segundos`}
                          />
                          <span className="muted">s</span>
                          {s.manualSeconds !== undefined && <button type="button" className="btn ghost" style={{ minHeight: 24, padding: "0 6px" }} onClick={() => setManual(i, undefined)}>Auto</button>}
                        </label>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : prog[s.id] ? (
                <div className="progress-box" style={{ margin: 0, aspectRatio: "9 / 16", maxHeight: 320, alignContent: "center" }}>
                  <span className="small">Subiendo… {prog[s.id]}%</span>
                  <div className="progress"><div className="progress-fill" style={{ width: `${prog[s.id]}%` }} /></div>
                </div>
              ) : (
                <label className="drop" style={{ aspectRatio: "9 / 16", maxHeight: 320, justifyContent: "center", alignItems: "center", textAlign: "center", cursor: "pointer", color: "var(--muted)" }}>
                  <span style={{ fontSize: 26 }}>+</span>
                  <span className="small">Subir el clip de esta toma</span>
                  <input type="file" accept="video/mp4,video/quicktime,.mp4,.mov,.m4v" hidden onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const only = [f];
                    // forzar que vaya a ESTA toma
                    (async () => {
                      setProg((p) => ({ ...p, [s.id]: 1 }));
                      try {
                        await save();
                        mergeClip(await uploadClip(initial.id, s.id, only[0], (pct) => setProg((p) => ({ ...p, [s.id]: pct }))));
                      } catch (err) {
                        setMsg(err instanceof Error ? err.message : "Falló la subida.");
                      } finally {
                        setProg((p) => { const c = { ...p }; delete c[s.id]; return c; });
                      }
                    })();
                    e.target.value = "";
                  }} />
                </label>
              )}

              {kind === "broll" && voiceOn && (
                <div className="stack small" style={{ gap: 4 }}>
                  {voiceReady(s) ? (
                    <>
                      <audio src={url(s.voice!)} controls preload="none" style={{ width: "100%", height: 34 }} />
                      <span className="muted">
                        Voz: {sec(s.voiceSeconds || 0)}
                        {s.clipSeconds && s.voiceSeconds && s.voiceSeconds + 0.2 > s.clipSeconds + 0.05 ? ` · es más larga que el clip (se congela el último cuadro). Mejor divide la frase en dos tomas.` : ""}
                      </span>
                    </>
                  ) : s.text.trim() ? (
                    <span className="muted">{s.voice ? "El texto cambió: hay que regenerar la voz." : "Voz todavía no creada."}</span>
                  ) : null}
                  {s.text.trim() && (
                    <button type="button" className="btn ghost" style={{ minHeight: 28, padding: "2px 6px", justifySelf: "start" }} disabled={!!voiceBusy} onClick={() => makeOne(s.id)}>
                      {voiceBusy === s.id ? "Creando voz…" : voiceReady(s) ? "Regenerar voz" : "Crear voz"}
                    </button>
                  )}
                </div>
              )}

              <label className="stack" style={{ gap: 4 }}>
                <span className="small muted">Lo que se dice (para los subtítulos)</span>
                <textarea value={s.text} onChange={(e) => setText(i, e.target.value)} rows={3} style={{ padding: 8, borderRadius: 4, border: "1px solid var(--line)", font: "inherit", fontSize: 14, resize: "vertical" }} />
              </label>

              <label className="stack" style={{ gap: 4 }}>
                <span className="small muted">Texto sobre el video (opcional: un título, una oferta, lo que quieras)</span>
                <input type="text" maxLength={160} value={s.overlayText ?? ""} onChange={(e) => setOverlay(i, { overlayText: e.target.value })} placeholder="Ej.: -30% solo hoy" style={{ padding: 8, borderRadius: 4, border: "1px solid var(--line)", font: "inherit", fontSize: 14 }} />
              </label>
              {(s.overlayText ?? "").trim() && (
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <span className="small muted">Dónde:</span>
                  {(["arriba", "centro", "abajo"] as const).map((pos) => (
                    <button key={pos} type="button" className="btn ghost" aria-pressed={(s.overlayPos ?? "arriba") === pos} style={{ minHeight: 30, padding: "2px 10px", borderWidth: 2, borderColor: (s.overlayPos ?? "arriba") === pos ? "#6EA8FF" : "transparent", textTransform: "capitalize" }} onClick={() => setOverlay(i, { overlayPos: pos })}>{pos}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button type="button" className="add-card" onClick={addSlot} style={{ minHeight: 140 }}>
            <span>+</span>
            Agregar una toma
          </button>
        </div>
      </section>

      {/* PASO 2 */}
      <section className="card stack" style={{ padding: 20, gap: 14 }}>
        <h2>2 · Ritmo del video</h2>
        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">¿Quién habla en tus clips?</span>
          <div className="row" style={{ gap: 10 }}>
            {([["ugc", "UGC · la persona habla en el clip"], ["broll", "B-roll · voz en off sobre las imágenes"]] as const).map(([k, label]) => (
              <button key={k} type="button" className="btn outline" aria-pressed={kind === k} onClick={() => change(setKind)(k)} style={{ borderColor: kind === k ? "var(--accent)" : "var(--line)", borderWidth: 3, background: kind === k ? "#E4EAF5" : "#fff" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="row" style={{ gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
          <input type="checkbox" checked={smartTrim} onChange={(e) => change(setSmartTrim)(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} />
          <span className="stack" style={{ gap: 2 }}>
            <strong>Recorte inteligente (recomendado)</strong>
            <span className="muted small">
              Flow siempre entrega clips de 4, 6, 8 o 10 segundos, pero lo que se dice casi nunca dura eso. La app corta lo que sobra de cada toma
              {kind === "ugc" ? " según el audio real: quita el silencio del principio y del final, para que no haya pausas y se mantenga la atención." : " según lo que tarda en decirse el texto de esa toma, para que la imagen cambie justo cuando cambia la idea."}
              {" "}Puedes ajustar el largo de cualquier toma a mano.
            </span>
          </span>
        </label>
        {kind === "broll" && (
          <div className="stack" style={{ gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <label className="row" style={{ gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
              <input type="checkbox" checked={voiceOn} onChange={(e) => change(setVoiceOn)(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} />
              <span className="stack" style={{ gap: 2 }}>
                <strong>Crear la voz en off con IA (acento chileno)</strong>
                <span className="muted small">La app lee el texto de cada toma con una voz natural. Como sabe cuánto dura cada frase, la imagen dura justo lo que se dice y la voz queda pegada a lo que se ve. El sonido original de los clips se silencia.</span>
              </span>
            </label>
            {!voiceOn && <span className="muted small">En B-roll el sonido original de Flow siempre se silencia: sin voz en off, el video queda sin audio para que le pongas tu propia voz.</span>}
            {voiceOn && (
              <div className="stack" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {VOICES.map((v) => (
                    <button key={v.id} type="button" className="btn outline" aria-pressed={voiceName === v.id} onClick={() => change(setVoiceName)(v.id)} style={{ borderColor: voiceName === v.id ? "var(--accent)" : "var(--line)", borderWidth: 3, background: voiceName === v.id ? "#E4EAF5" : "#fff" }}>
                      {v.label}
                    </button>
                  ))}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="small muted">Velocidad:</span>
                  {([[1, "Normal"], [1.25, "Rápida"], [1.4, "Muy rápida"]] as const).map(([v, l]) => (
                    <button key={v} type="button" className="btn outline" aria-pressed={voiceSpeed === v} onClick={() => setVoiceSpeed(v)} style={{ borderColor: voiceSpeed === v ? "var(--accent)" : "var(--line)", borderWidth: 3, background: voiceSpeed === v ? "#E4EAF5" : "#fff" }}>
                      {l}
                    </button>
                  ))}
                  {slots.some((s) => s.voice && Math.abs((s.voiceSpeed ?? 1) - voiceSpeed) > 0.01) && (
                    <button type="button" className="btn" onClick={() => makeVoices(false)} disabled={!!voiceBusy}>Aplicar a las voces ya creadas</button>
                  )}
                </div>
                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <button type="button" className="btn outline" onClick={trySample} disabled={!!voiceBusy}>{voiceBusy === "sample" ? "Creando muestra…" : "▶ Escuchar esta voz"}</button>
                  <button type="button" className="btn" onClick={() => makeVoices(false)} disabled={!!voiceBusy || !slots.some((s) => s.text.trim())}>{voiceBusy === "all" ? "Creando voces…" : "Crear las voces de todas las tomas"}</button>
                  {slots.some((s) => s.voice) && <button type="button" className="btn ghost" onClick={() => makeVoices(true)} disabled={!!voiceBusy}>Regenerar todas</button>}
                </div>
                {sample && <audio src={url(sample)} controls autoPlay style={{ width: "100%", maxWidth: 420 }} />}
                <span className="muted small">Si no cambias nada, las voces se crean solas al apretar "Crear video".</span>
              </div>
            )}
          </div>
        )}
        {withClip.length > 0 && (
          <p className="small" style={{ background: "#E3F1E9", color: "#1F5E3E", padding: "8px 12px", borderRadius: 4 }}>
            {smartTrim ? `Con el recorte, el video dura ${sec(total)} en vez de ${sec(original)}.` : `Sin recorte, el video dura ${sec(original)}.`}
          </p>
        )}
      </section>

      {/* PASO 3 */}
      <section className="card stack" style={{ padding: 20, gap: 14 }}>
        <h2>3 · Subtítulos</h2>
        <label className="row" style={{ gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={subtitles} onChange={(e) => change(setSubtitles)(e.target.checked)} style={{ width: 20, height: 20 }} />
          <span>Poner subtítulos con el texto de cada toma</span>
        </label>
        {subtitles && (
          <>
            <div className="stack" style={{ gap: 6 }}>
              <span className="small muted">Tipografía</span>
              <div className="row" style={{ gap: 10 }}>
                {FONT_OPTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => change(setSubFont)(f.id)}
                    aria-pressed={subFont === f.id}
                    className="btn outline"
                    style={{ background: "#14181f", color: subStyle === "amarillo" ? "#FFE14A" : "#fff", borderColor: subFont === f.id ? "#6EA8FF" : "transparent", borderWidth: 3, fontFamily: `"sub-${f.id}", sans-serif`, fontSize: 22, minHeight: 56, padding: "6px 18px", textTransform: f.upper ? "uppercase" : "none", WebkitTextStroke: "0.8px #000" }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <span className="small muted">Color</span>
              <div className="row" style={{ gap: 10 }}>
                {(["blanco", "amarillo", "caja", "cajablanca"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => change(setSubStyle)(st)}
                    aria-pressed={subStyle === st}
                    className="btn outline"
                    style={{ background: st === "caja" ? "rgba(0,0,0,0.62)" : st === "cajablanca" ? "#fff" : "#14181f", color: st === "amarillo" ? "#FFE14A" : st === "cajablanca" ? "#000" : "#fff", borderColor: subStyle === st ? "#6EA8FF" : "transparent", borderWidth: 3, fontWeight: 800 }}
                  >
                    {st === "amarillo" ? "Amarillo" : st === "caja" ? "Recuadro negro" : st === "cajablanca" ? "Recuadro blanco" : "Blanco"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: "#2b3140", borderRadius: 6, padding: "22px 12px", textAlign: "center" }} aria-label="Vista previa de los subtítulos">
              <span style={{ fontFamily: `"sub-${subFont}", sans-serif`, fontSize: 23, color: subStyle === "amarillo" ? "#FFE14A" : subStyle === "cajablanca" ? "#000" : "#fff", ...(subStyle === "caja" || subStyle === "cajablanca" ? { background: subStyle === "cajablanca" ? "#fff" : "rgba(0,0,0,0.62)", padding: "6px 16px", borderRadius: 8 } : { WebkitTextStroke: "5px #000", paintOrder: "stroke fill" as const }), textTransform: FONT_OPTS.find((f) => f.id === subFont)?.upper ? "uppercase" : "none" }}>
                Así se verán tus subtítulos
              </span>
            </div>
          </>
        )}
        <span className="muted small">
          {smartTrim
            ? "Los subtítulos siguen la voz: en UGC se reparten sobre el tramo en que se habla de verdad; en B-roll, sobre el tiempo que toma decir el texto."
            : "Los subtítulos se reparten según lo que dura cada clip."}
        </span>
      </section>

      {/* PASO 4 */}
      <section className="card stack" style={{ padding: 20, gap: 14 }}>
        <h2>4 · Crear el video</h2>
        <p className="muted">
          {withClip.length} de {slots.length} clips subidos · {sec(total)} en total · vertical 9:16
          {missing.length > 0 && withClip.length > 0 && ` · faltan las tomas ${missing.join(", ")} (se saltan)`}
        </p>

        {voiceBusy === "all" && !rendering && (
          <div className="progress-box" style={{ margin: 0 }} role="status" aria-live="polite">
            <strong>Creando las voces en off…</strong>
            <div className="progress"><div className="progress-fill" style={{ width: "60%", animation: "pulse 1.2s ease-in-out infinite alternate" }} /></div>
            <span className="muted small">Son unos 2 a 4 segundos por toma. Después se arma el video solo.</span>
          </div>
        )}
        {rendering && (job.queued ?? 0) > 0 ? (
          <div className="progress-box" style={{ margin: 0 }} role="status" aria-live="polite">
            <strong>Hay mucha gente creando videos en este momento</strong>
            <span className="small">
              Por eso el tuyo se demora un poco más. {job.queued === 1 ? "Hay 1 video antes que el tuyo" : `Hay ${job.queued} videos antes que el tuyo`} y empieza solo cuando le toque.
            </span>
            <span className="muted small">No cierres esta página.</span>
          </div>
        ) : rendering ? (
          <div className="progress-box" style={{ margin: 0 }} role="status" aria-live="polite">
            <strong>Creando tu video… {job.progress ?? 0}%</strong>
            <div className="progress"><div className="progress-fill" style={{ width: `${Math.max(4, job.progress ?? 0)}%` }} /></div>
            <span className="muted small">{job.stage ? `${job.stage} · ` : ""}{etaText(job)}</span>
            <span className="muted small">No cierres esta página.</span>
          </div>
        ) : (
          <div className="row">
            <button type="button" className="btn xl" onClick={create} disabled={!withClip.length || uploading}>
              {job.status === "done" ? "Crear de nuevo" : "Crear video"}
            </button>
            {uploading && <span className="muted small">Espera a que terminen las subidas.</span>}
          </div>
        )}
        {!rendering && (
          <p className="muted small" style={{ margin: 0 }}>
            Si hay mucha gente creando videos al mismo tiempo, el tuyo espera su turno en una cola y se arma solo. Cuando el video queda listo, borramos los clips que subiste para ahorrar espacio, así que descarga tu MP4 (si quieres cambiar algo, tendrás que subir los clips otra vez). El video final se guarda 30 días.
          </p>
        )}
        {job.status === "error" && <p className="error" role="alert">{job.error || "Algo falló al crear el video."}</p>}

        {job.status === "done" && job.output && !rendering && (
          <div className="stack" style={{ gap: 12, alignItems: "flex-start" }}>
            <video src={url(job.output)} controls playsInline style={{ width: 270, maxWidth: "100%", aspectRatio: "9 / 16", background: "#000", borderRadius: 6 }} />
            <a className="btn" href={url(job.output)} download={`${(title || "video").replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ -]/g, "").trim() || "video"}.mp4`}>Descargar MP4</a>
            <span className="muted small">{sec(job.outputSeconds || 0)} · se borra el {expires}</span>
          </div>
        )}
      </section>
    </div>
  );
}
