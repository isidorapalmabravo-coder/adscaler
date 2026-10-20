// Google Flow (Veo) solo genera clips de 4, 6, 8 o 10 segundos. Nada más.
export const FLOW_SECONDS = [4, 6, 8, 10] as const;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Duración mínima para decir el audio (español chileno, ~3 palabras por segundo, con un pequeño margen). */
export function secondsForAudio(audio: string): number {
  const w = words(audio);
  return w <= 11 ? 4 : w <= 17 ? 6 : w <= 24 ? 8 : 10;
}

/** Lleva cualquier duración al valor de Flow MÁS CERCANO (en empate, el menor): cada segundo gasta créditos. */
export function snapSeconds(n: number): number {
  if (n <= 4) return 4;
  return FLOW_SECONDS.reduce((best, x) => (Math.abs(x - n) < Math.abs(best - n) ? x : best), 4 as number);
}

function parseSeconds(d: string): number {
  const m = (d || "").replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

/**
 * Garantiza que la toma dure 4, 6, 8 o 10 s, y que el prompt de animación lo diga.
 * UGC: la más corta que alcance para decir todo el audio (manda el audio, no el brief).
 * B-roll: la duración del brief llevada al valor de Flow más cercano; sin dato, 4 s.
 */
export function fixDuration(type: "ugc" | "broll", audio: string, duration: string, animation: string) {
  const fromBrief = snapSeconds(parseSeconds(duration));
  const n = type === "ugc" && audio.trim() ? secondsForAudio(audio) : parseSeconds(duration) ? fromBrief : 4;
  const re = /\b\d+(?:[.,]\d+)?\s*(?:-\s*)?seconds?\b/i;
  const anim = re.test(animation) ? animation.replace(re, `${n} seconds`) : `${animation.trim()} Duration: ${n} seconds.`;
  return { duration: `${n} s`, seconds: n, animation: anim };
}
