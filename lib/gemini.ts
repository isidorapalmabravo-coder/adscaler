import { silenceBroll, noCameraImage } from "./broll";
import { fixDuration } from "./duration";
import { withAnatomy, withAnatomyMotion, withProductShape, withVertical } from "./anatomy";
import fs from "fs";
import { GoogleGenAI, Type, createPartFromUri, type Part } from "@google/genai";
import type { Analysis, Avatar, BrollMode, Project, Shot, Understanding, VideoType } from "./types";
import { hasCharacter, isAnimated } from "./types";
import {
  AVATAR_INSTRUCTION,
  animationInstruction,
  UNDERSTAND_INSTRUCTION,
  projectContext,
  systemInstruction,
  understandingToText,
} from "./prompts";
import { mockAnalysis, mockAvatars } from "./mock";
import { filePath, mimeOf } from "./files";

// Flash-Lite por defecto: en la prueba real salió ~19 veces más barato que Pro con las mismas tomas. Para "mayor calidad": GEMINI_MODEL=gemini-3.1-pro-preview
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

/** Google a veces responde 503 ("modelo con alta demanda") o 429. Reintenta con pausa y, si sigue saturado, prueba el otro modelo. */
// Solo se baja de Pro a Flash-Lite (más barato). Nunca se sube a Pro por saturación: cuesta ~19 veces más.
const FALLBACK: Record<string, string> = {
  "gemini-3.1-pro-preview": "gemini-3.1-flash-lite",
};
function isBusy(e: unknown) {
  const m = String((e as { message?: string })?.message ?? e);
  return /"code":\s*(503|429|500)|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(m);
}
type GenParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];
async function generate(ai: GoogleGenAI, params: GenParams) {
  const waits = [3000, 8000, 15000, 25000];
  const models = [params.model, FALLBACK[params.model as string]].filter(Boolean) as string[];
  let lastErr: unknown;
  for (const model of models) {
    for (let i = 0; i <= waits.length; i++) {
      try {
        return await ai.models.generateContent({ ...params, model });
      } catch (e) {
        lastErr = e;
        if (!isBusy(e)) throw e;
        if (i < waits.length) await new Promise((r) => setTimeout(r, waits[i]));
      }
    }
  }
  throw lastErr;
}

/** Cuántos tokens gastó cada llamada (para saber el costo real y comparar modelos). */
export type UsageFn = (step: string, model: string, tokensIn: number, tokensOut: number) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function report(fn: UsageFn | undefined, step: string, model: string, res: any) {
  const u = res?.usageMetadata;
  if (!fn || !u) return;
  fn(step, model, Number(u.promptTokenCount ?? 0), Number(u.candidatesTokenCount ?? 0) + Number(u.thoughtsTokenCount ?? 0));
}

export function hasGemini() {
  return !!process.env.GEMINI_API_KEY;
}

function client() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
}

/* ---------------- Esquemas de respuesta ---------------- */

const S = { type: Type.STRING };
const B = { type: Type.BOOLEAN };

const understandSchema = {
  type: Type.OBJECT,
  properties: {
    summary: S,
    productLook: S,
    promise: S,
    tone: S,
    hook: S,
    rules: { type: Type.ARRAY, items: S },
    continuity: S,
    referenceStyle: S,
    durationSeconds: { type: Type.NUMBER },
    personaSpec: S,
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { time: S, duration: S, kind: S, audio: S, visual: S, reference: S, edit: S, character: B, product: B },
        required: ["time", "duration", "kind", "audio", "visual", "edit", "character", "product"],
      },
    },
  },
  required: ["summary", "productLook", "promise", "tone", "hook", "rules", "continuity", "referenceStyle", "scenes"],
};

const writeSchema = {
  type: Type.OBJECT,
  properties: {
    personaPrompt: S,
    shots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: S,
          duration: S,
          kind: S,
          audio: S,
          imagePrompt: S,
          animationPrompt: S,
          edit: S,
          showsCharacter: B,
          showsProduct: B,
        },
        required: ["time", "duration", "kind", "audio", "imagePrompt", "animationPrompt", "edit"],
      },
    },
  },
  required: ["personaPrompt", "shots"],
};

/* ---------------- Utilidades ---------------- */

function parseJson<T>(text: string | undefined): T {
  const clean = (text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(clean || "{}") as T;
}

async function uploadVideo(ai: GoogleGenAI, name: string): Promise<Part> {
  let f = await ai.files.upload({ file: filePath(name), config: { mimeType: mimeOf(name) } });
  // Gemini procesa el video antes de poder usarlo
  for (let i = 0; i < 60 && f.state === "PROCESSING"; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    f = await ai.files.get({ name: f.name! });
  }
  if (f.state !== "ACTIVE") throw new Error("Gemini no pudo procesar un video de referencia");
  return createPartFromUri(f.uri!, f.mimeType!);
}

// Fotos reales del producto, achicadas, para que Gemini "vea" el producto
async function photoParts(photos: string[]): Promise<Part[]> {
  const out: Part[] = [];
  for (const name of photos.slice(0, 3)) {
    try {
      const raw: Buffer = fs.readFileSync(filePath(name));
      let data: Buffer = raw;
      let mimeType = mimeOf(name);
      try {
        const sharp = (await import("sharp")).default;
        data = Buffer.from(
          await sharp(raw, { failOn: "none" })
            .rotate()
            .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer()
        );
        mimeType = "image/jpeg";
      } catch {
        /* sin sharp: se envía el original */
      }
      if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") {
        out.push({ inlineData: { data: data.toString("base64"), mimeType } });
      }
    } catch {
      /* foto no encontrada: se omite */
    }
  }
  return out;
}

/* ---------------- Paso 1: entender el brief ---------------- */

interface UnderstandOut extends Understanding {
  summary: string;
  durationSeconds?: number;
  personaSpec?: string;
  scenes: { time: string; duration: string; kind: string; audio: string; visual: string; reference?: string; edit: string; character?: boolean; product?: boolean }[];
}

async function understand(
  ai: GoogleGenAI,
  opts: { project: Project; avatar: Avatar | null; type: VideoType; mode?: BrollMode; animStyle?: string; briefText: string; notes: string; refVideos: string[] },
  model: string,
  onUsage?: UsageFn
): Promise<UnderstandOut> {
  const [videoParts, imgParts] = await Promise.all([
    Promise.all(opts.refVideos.map((v) => uploadVideo(ai, v))),
    photoParts(opts.project.photos),
  ]);
  const text = `${projectContext(opts.project, opts.avatar)}

TIPO DE VIDEO: ${opts.type === "ugc" ? "UGC (persona hablando a cámara)" : `B-roll con voz en off, clase: ${opts.mode ?? "cortes"}${isAnimated(opts.type, opts.mode) ? ` (animado${opts.animStyle ? `, estilo: ${opts.animStyle}` : ""})` : ""}`}
${opts.mode === "cortes_persona" || opts.mode === "animado_cortes_personaje" ? "\nEn este video HAY UNA PERSONA O PERSONAJE PRINCIPAL que se repite en varias tomas (la persona fija del brief; describe en personaSpec solo a ella). Marca character = true SOLO en las tomas donde el VISUAL dice que ella aparece; en las demás tomas hay otras personas u objetos distintos (character = false)." : ""}
NOTAS EXTRA DEL USUARIO: ${opts.notes || "(ninguna)"}
${imgParts.length ? `Se adjuntan ${imgParts.length} foto(s) real(es) del producto.` : "Sin fotos del producto."}
${videoParts.length ? `Se adjuntan ${videoParts.length} video(s) de referencia.` : "Sin videos de referencia."}

BRIEF (puede venir en HTML convertido desde Word):
${opts.briefText}`;

  // Hasta 2 intentos. Las tomas NO son obligatorias: si el brief no las trae (o la IA no
  // las devuelve), el paso 2 las crea a partir del guion.
  let data = {} as UnderstandOut;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await generate(ai, {
      model,
      contents: [{ role: "user", parts: [...imgParts, ...videoParts, { text }] }],
      config: {
        systemInstruction: UNDERSTAND_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: understandSchema,
        maxOutputTokens: 32768,
      },
    });
    report(onUsage, "entender", model, res);
    try {
      data = parseJson<UnderstandOut>(res.text);
    } catch {
      data = {} as UnderstandOut;
    }
    if (data.summary || data.scenes?.length) break;
    console.error("[plano] paso 1 sin respuesta útil:", res.candidates?.[0]?.finishReason, (res.text ?? "").slice(0, 400));
  }
  return { ...data, summary: data.summary ?? "", rules: data.rules ?? [], scenes: data.scenes ?? [] };
}

/* ---------------- Paso 2: escribir los prompts ---------------- */

async function writePrompts(
  ai: GoogleGenAI,
  type: VideoType,
  project: Project,
  avatar: Avatar | null,
  u: UnderstandOut,
  briefText: string,
  mode: BrollMode | undefined,
  animStyle: string | undefined,
  model: string,
  onUsage?: UsageFn
) {
  const hasScenes = u.scenes.length > 0;
  const text = `${projectContext(project, avatar)}

${understandingToText(u)}

${hasCharacter(type, mode) ? `PERSONAJE PRINCIPAL (para personaPrompt): ${u.personaSpec || "(dedúcelo del avatar y del brief)"}` : "VIDEO SIN PERSONAJE FIJO: personaPrompt vacío. Cada toma es independiente y su imagePrompt describe todo lo que se ve."}

${
  hasScenes
    ? `TOMAS A ESCRIBIR (${u.scenes.length}, en este orden, no agregues ni quites ninguna):
${JSON.stringify(u.scenes.map((s, i) => ({ n: i + 1, ...s })), null, 1)}

IMPORTANTE: en cada toma, "character" y "product" indican si el personaje fijo y el producto SE VEN en esa toma. Si es false, NO los pongas en el imagePrompt ni en el animationPrompt de esa toma (ni una mano que lo sostiene). Copia esos valores en showsCharacter y showsProduct.`
    : `NO HAY TOMAS DEFINIDAS. Crea tú las tomas a partir del brief (si trae guion o tabla, respétalos; si no, escribe un guion corto de 20 a 30 segundos para el avatar y divídelo en tomas de 4, 6, 8 o 10 segundos, siempre la más corta que alcance, nunca otra duración). Devuelve todas las tomas necesarias, en orden.

BRIEF:
${briefText.slice(0, 120000)}`
}`;

  let last: { personaPrompt?: string; shots?: Record<string, string>[] } = {};
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await generate(ai, {
      model,
      contents: text + (attempt ? "\n\nIMPORTANTE: devuelve exactamente una toma por cada escena indicada." : ""),
      config: {
        systemInstruction: systemInstruction(type, mode, animStyle),
        responseMimeType: "application/json",
        responseSchema: writeSchema,
      },
    });
    report(onUsage, "escribir", model, res);
    last = parseJson(res.text);
    if ((last.shots?.length ?? 0) >= Math.max(u.scenes.length, 1)) break;
  }
  if (!last.shots?.length) throw new Error("La IA no devolvió tomas. Revisa la Terminal o inténtalo otra vez.");
  return last;
}

/* ---------------- Garantía: en UGC la persona SIEMPRE habla ---------------- */

const norm = (x: string) => x.replace(/[\s"“”«»'.,;:¡!¿?]+/g, " ").trim().toLowerCase();

// Si la IA se olvidó de poner el audio dentro del prompt de animación, se agrega aquí.
function ensureSpeech(type: VideoType, kind: string, audio: string, animation: string) {
  if (type !== "ugc") {
    return { kind, animation: silenceBroll(animation) };
  }
  const line = audio.trim().replace(/^["“]|["”]$/g, "");
  let anim = animation;
  if (line && !norm(anim).includes(norm(line))) {
    anim = `${anim.trim().replace(/\s*$/, "")} The person speaks directly to camera with Chilean Spanish accent, phonetic cadence and natural lip articulation, saying exactly: "${line}".`;
  }
  // Garantía: en UGC el prompt de animación SIEMPRE dice que habla con acento chileno (Flow lo necesita para la voz)
  if (!/chilean spanish accent/i.test(anim)) {
    anim = `${anim.trim().replace(/\s*$/, "")} The person speaks with a natural Chilean Spanish accent, Chilean speech rhythm and mouth shapes.`;
  }
  return { kind: "UGC", animation: anim };
}

/* ---------------- API pública ---------------- */

export async function analyzeBrief(opts: {
  project: Project;
  avatar: Avatar | null;
  type: VideoType;
  mode?: BrollMode;
  animStyle?: string;
  briefText: string;
  notes: string;
  refVideos: string[];
  /** Para comparar modelos: uno para entender el brief y otro para escribir las tomas. */
  models?: { understand?: string; write?: string };
  onUsage?: UsageFn;
}): Promise<Analysis> {
  if (!hasGemini()) return mockAnalysis(opts.project, opts.type);

  const ai = client();
  const mU = opts.models?.understand ?? process.env.GEMINI_UNDERSTAND_MODEL ?? MODEL;
  const mW = opts.models?.write ?? MODEL;
  const u = await understand(ai, opts, mU, opts.onUsage);
  const w = await writePrompts(ai, opts.type, opts.project, opts.avatar, u, opts.briefText, opts.mode, opts.animStyle, mW, opts.onUsage);

  const shots: Shot[] = (w.shots ?? []).map((s: Record<string, unknown> & { audio?: string; kind?: string; animationPrompt?: string; duration?: string; time?: string; imagePrompt?: string; edit?: string }, i) => {
      const audio = s.audio ?? u.scenes[i]?.audio ?? "";
      const rawKind = s.kind ?? u.scenes[i]?.kind ?? "";
      const fixed = ensureSpeech(opts.type, opts.type === "broll" && /ugc/i.test(rawKind) ? "B-roll" : rawKind, audio, s.animationPrompt ?? "");
      const dur = fixDuration(opts.type, audio, s.duration ?? u.scenes[i]?.duration ?? "", fixed.animation);
      return {
        n: i + 1,
        time: s.time ?? u.scenes[i]?.time ?? "",
        duration: dur.duration,
        kind: fixed.kind,
        audio,
        imagePrompt: (opts.type === "ugc" ? withAnatomy(s.imagePrompt ?? "") : noCameraImage(withAnatomy(s.imagePrompt ?? ""))),
        animationPrompt: withProductShape(withAnatomyMotion(dur.animation), u.scenes[i]?.product ?? (s as { showsProduct?: boolean }).showsProduct ?? true),
        edit: s.edit ?? u.scenes[i]?.edit ?? "",
        // Quién y qué se ve en la toma: manda lo que dice el VISUAL del brief (entendimiento), no lo que improvise la IA
        showsCharacter: hasCharacter(opts.type, opts.mode)
          ? opts.type === "ugc" || (u.scenes[i]?.character ?? (s as { showsCharacter?: boolean }).showsCharacter ?? true)
          : false,
        showsProduct: u.scenes[i]?.product ?? (s as { showsProduct?: boolean }).showsProduct ?? true,
      };
    });
  let clock = 0;
  for (const s of shots) {
    s.time = `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, "0")}`;
    clock += parseInt(s.duration, 10) || 0;
  }

  return {
    summary: u.summary ?? "",
    durationSeconds: clock,
    personaPrompt: hasCharacter(opts.type, opts.mode) ? withAnatomy(w.personaPrompt ?? "") : "",
    shots,
    understanding: {
      productLook: u.productLook ?? "",
      promise: u.promise ?? "",
      tone: u.tone ?? "",
      hook: u.hook ?? "",
      rules: u.rules ?? [],
      continuity: u.continuity ?? "",
      referenceStyle: u.referenceStyle ?? "",
    },
  };
}

export async function suggestAvatars(project: Project): Promise<Omit<Avatar, "id">[]> {
  if (!hasGemini()) return mockAvatars(project);
  const res = await generate(client(), {
    model: MODEL,
    contents: projectContext(project, null),
    config: {
      systemInstruction: AVATAR_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          avatars: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { name: S, description: S },
              required: ["name", "description"],
            },
          },
        },
        required: ["avatars"],
      },
    },
  });
  return parseJson<{ avatars?: Omit<Avatar, "id">[] }>(res.text).avatars ?? [];
}

/* ---------------- Regenerar solo el prompt de animación de una toma ---------------- */

export async function rewriteAnimation(opts: {
  project: Project;
  avatar: Avatar | null;
  type: VideoType;
  mode?: BrollMode;
  animStyle?: string;
  personaPrompt: string;
  productLook: string;
  shot: { kind: string; duration: string; audio: string; imagePrompt: string; animationPrompt: string; showsProduct?: boolean };
  change: string;
}): Promise<string> {
  const { shot, type } = opts;
  let out = shot.animationPrompt;
  if (hasGemini()) {
    const text = `${projectContext(opts.project, opts.avatar)}

PERSONA (para edad y género): ${opts.personaPrompt || "(no definida)"}
PRODUCTO REAL (rasgos): ${opts.productLook || "(sin datos)"}

TOMA
- Duración indicada: ${shot.duration}
- Lo que dice (AUDIO, exacto): ${shot.audio || "(sin audio)"}
- Imagen del primer cuadro: ${shot.imagePrompt}
- Prompt de animación actual: ${shot.animationPrompt}

CAMBIO PEDIDO POR EL USUARIO: ${opts.change || "(ninguno: mejóralo y hazlo más natural y específico, sin cambiar lo que dice)"}`;
    const res = await generate(client(), {
      model: MODEL,
      contents: text,
      config: { systemInstruction: animationInstruction(type, opts.mode, opts.animStyle), maxOutputTokens: 4096 },
    });
    const clean = (res.text ?? "").trim().replace(/^```\w*\s*/, "").replace(/\s*```$/, "").trim();
    if (clean) out = clean;
    else throw new Error("La IA no devolvió un prompt. Inténtalo otra vez.");
  } else if (opts.change) {
    out = `${out.trim()} Adjustment: ${opts.change}.`;
  }
  const spoken = ensureSpeech(type, shot.kind, shot.audio, out).animation;
  return withProductShape(withVertical(fixDuration(type, shot.audio, shot.duration, spoken).animation), shot.showsProduct !== false);
}
