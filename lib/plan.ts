import type { EditKind, EditSlot } from "./types";

/** Palabras por segundo de una voz natural en español chileno (con una pausa mínima). */
export const WORDS_PER_SEC = 2.9;

export const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const r2 = (n: number) => Math.round(n * 20) / 20; // de a 0,05 s

export interface SlotPlan {
  start: number; // desde dónde se usa el clip
  dur: number; // cuánto se usa
  speechFrom: number; // dentro del tramo usado, cuándo empieza a hablarse
  speechTo: number; // y cuándo termina
  mode: "completo" | "audio" | "guion" | "manual" | "voz";
  cut: number; // segundos que se cortan
  hold: number; // segundos que se congela el último cuadro (la voz dura más que el clip)
  voice: boolean; // se usa la voz en off generada
}

/** ¿Esta toma tiene una voz generada que corresponde al texto actual? */
export const voiceReady = (s: EditSlot) => !!s.voice && !!s.voiceSeconds && (s.voiceText ?? "") === s.text.trim();

/**
 * Decide qué parte de cada clip se usa, para que el video no tenga pausas:
 * - UGC: se corta según el audio real (donde empieza y termina la voz).
 * - B-roll: se corta según lo que tarda en decirse el texto de esa toma.
 * - Manual: la persona fijó el largo.
 */
export function planSlot(kind: EditKind, smart: boolean, s: EditSlot, voiceOn = false): SlotPlan {
  const clip = s.clipSeconds || 0;
  if (!s.clip || clip <= 0) return { start: 0, dur: 0, speechFrom: 0, speechTo: 0, mode: "completo", cut: 0, hold: 0, voice: false };

  const w = countWords(s.text);
  const est = w / WORDS_PER_SEC;
  const hasVoice = kind === "ugc" && s.speechStart !== undefined && s.speechEnd !== undefined && s.speechEnd - s.speechStart > 0.4;

  // Tramo automático
  let start = 0;
  let dur = clip;
  let mode: SlotPlan["mode"] = "completo";
  let from = Math.min(0.15, clip / 4);
  let to = Math.max(from + 0.5, Math.min(clip - 0.2, from + est));

  if (smart) {
    if (hasVoice) {
      start = Math.max(0, s.speechStart! - 0.12);
      const end = Math.min(clip, s.speechEnd! + 0.3);
      dur = end - start;
      from = s.speechStart! - start;
      to = s.speechEnd! - start;
      mode = "audio";
    } else if (w > 0) {
      dur = Math.min(clip, Math.max(1, est + 0.35));
      from = 0.1;
      to = Math.max(from + 0.4, dur - 0.2);
      mode = "guion";
    }
  } else if (hasVoice) {
    from = s.speechStart!;
    to = s.speechEnd!;
  }

  // Voz en off generada: el largo sale de la voz real, no de una estimación
  // Si fijaste el largo a mano, la toma dura eso (sin cortar la voz) y la voz suena igual.
  if (kind === "broll" && voiceOn && voiceReady(s)) {
    const manual = s.manualSeconds && s.manualSeconds > 0 ? s.manualSeconds : 0;
    const want = r2(manual ? Math.max(manual, s.voiceSeconds! + 0.15) : s.voiceSeconds! + 0.35);
    const used = Math.min(clip, want);
    return { start: 0, dur: want, speechFrom: 0.05, speechTo: Math.min(want, s.voiceSeconds! + 0.05), mode: "voz", cut: Math.max(0, r2(clip - used)), hold: Math.max(0, r2(want - clip)), voice: true };
  }

  if (s.manualSeconds && s.manualSeconds > 0) {
    dur = Math.min(clip, Math.max(0.5, s.manualSeconds));
    if (start + dur > clip) start = Math.max(0, clip - dur);
    to = Math.min(to, dur - 0.1);
    from = Math.min(from, Math.max(0, to - 0.4));
    mode = "manual";
  }

  dur = Math.min(clip, r2(dur));
  start = Math.max(0, r2(start));
  if (start + dur > clip) dur = r2(clip - start);
  return { start, dur, speechFrom: Math.max(0, from), speechTo: Math.max(from + 0.3, Math.min(to, dur)), mode, cut: Math.max(0, r2(clip - dur)), hold: 0, voice: false };
}
