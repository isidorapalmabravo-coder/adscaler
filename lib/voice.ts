import fs from "fs";
import { filePath, saveBuffer } from "./files";
import { newId } from "./db";
import { probe, run } from "./video-edit";

import { VOICES, DEFAULT_VOICE } from "./voice-list";

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts";
// Dirección de actuación: que suene como una persona real y no como un lector robótico.
const BASE_STYLE =
  process.env.GEMINI_TTS_STYLE ||
  "Natural Chilean Spanish (español de Chile). Speak like a real person recording a voice note for one friend: relaxed, warm and spontaneous, with natural rhythm, light breaths and a lot of intonation. Rise and fall on the key words, stress the benefits and the numbers, let a small smile show in the voice. Never sound like an announcer, a news reader or a robot: no flat monotone, no stiff or over-pronounced words, no mechanical pauses. Lively, fairly quick pace without long silences.";
const VOICE_STYLE: Record<string, string> = {
  Kore: "Voice character: a woman, firm and clear. Confident, crisp diction, steady and convincing.",
  Leda: "Voice character: a woman, close and friendly, like a good friend sharing a tip. Warm, intimate, easy.",
  Gacrux: "Voice character: a woman, elegant and refined. Poised, smooth and polished, a premium tone that flows without rushing.",
  Puck: "Voice character: a man, animated and upbeat. Enthusiastic, expressive, lots of energy and color.",
  Orus: "Voice character: a man, secure and assertive. Steady, confident, trustworthy, approachable authority.",
  Charon: "Voice character: a man, calm and reassuring. Low, smooth and relaxed, never hurried.",
};
const styleFor = (voice: string) => `${BASE_STYLE} ${VOICE_STYLE[voice] ?? ""}`.trim();

export function hasTTS() {
  return !!process.env.GEMINI_API_KEY;
}

function wav(pcm: Buffer, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function callTTS(text: string, voice: string): Promise<Buffer> {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: styleFor(voice) }] }] }],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice }] },
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    let msg = raw;
    try {
      msg = JSON.parse(raw)?.error?.message ?? raw;
    } catch {}
    throw new Error(`Gemini (${TTS_MODEL}) respondió ${res.status}: ${msg}`.slice(0, 400));
  }
  const j = JSON.parse(raw) as { steps?: { type?: string; content?: { type?: string; data?: string }[] }[] };
  const audios = (j.steps ?? []).filter((x) => x.type === "model_output").flatMap((x) => (x.content ?? []).filter((c) => c.type === "audio" && c.data));
  const last = audios[audios.length - 1];
  if (!last?.data) throw new Error("Gemini no devolvió audio");
  const buf = Buffer.from(last.data, "base64");
  return buf.subarray(0, 4).toString() === "RIFF" ? buf : wav(buf);
}

/**
 * Genera la voz de un texto con Gemini TTS, le quita el silencio del inicio y del final
 * y devuelve el archivo y su duración exacta.
 */
/** Deja el texto como se dice en voz alta: símbolos que la voz no lee bien se escriben con palabras. */
export function cleanForSpeech(t: string) {
  return t
    .replace(/\(\*\)/g, "")
    .replace(/★+/g, "")
    .replace(/\s*\+\s*/g, " más ")
    .replace(/(\d+)\s*%/g, "$1 por ciento")
    .replace(/&/g, " y ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export const DEFAULT_SPEED = 1.25;
export const clampSpeed = (n: unknown) => (typeof n === "number" && n >= 0.8 && n <= 1.6 ? n : DEFAULT_SPEED);

export async function synthesize(text: string, voice: string, speed = DEFAULT_SPEED): Promise<{ file: string; seconds: number }> {
  if (!hasTTS()) throw new Error("Falta la clave de Gemini (GEMINI_API_KEY) para crear la voz.");
  const v = VOICES.some((x) => x.id === voice) ? voice : DEFAULT_VOICE;

  text = cleanForSpeech(text);
  let audio: Buffer | null = null;
  let lastErr = "";
  for (let attempt = 0; attempt < 3 && !audio; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt));
    try {
      audio = await callTTS(text, v);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (/ 40[0134] /.test(lastErr)) break; // clave o modelo mal: reintentar no sirve
    }
  }
  if (!audio || audio.length < 2000) throw new Error(`No se pudo crear la voz. ${lastErr}`.slice(0, 450));

  const raw = saveBuffer(audio, "wav");
  const out = `${newId()}.wav`;
  // Quita silencio al inicio y al final (así la duración es la de lo que realmente se dice)
  const { code } = await run([
    "-hide_banner", "-y", "-i", filePath(raw),
    "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse" + (speed !== 1 ? `,atempo=${speed}` : ""),
    "-ar", "44100", filePath(out),
  ]);
  try {
    fs.unlinkSync(filePath(raw));
  } catch {}
  if (code !== 0) throw new Error("No se pudo procesar el audio de la voz.");
  const info = await probe(filePath(out));
  if (!info.seconds) throw new Error("La voz salió vacía. Prueba otra vez.");
  return { file: out, seconds: Math.round(info.seconds * 100) / 100 };
}


/** Cambia la velocidad de una voz ya creada (sin volver a llamar a la IA). ratio > 1 = más rápido. */
export async function retime(file: string, ratio: number): Promise<{ file: string; seconds: number }> {
  const out = `${newId()}.wav`;
  const { code } = await run(["-hide_banner", "-y", "-i", filePath(file), "-af", `atempo=${ratio}`, "-ar", "44100", filePath(out)]);
  if (code !== 0) throw new Error("No se pudo cambiar la velocidad de la voz.");
  const info = await probe(filePath(out));
  if (!info.seconds) throw new Error("La voz salió vacía.");
  return { file: out, seconds: Math.round(info.seconds * 100) / 100 };
}
