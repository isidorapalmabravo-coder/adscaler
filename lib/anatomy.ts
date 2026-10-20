// Regla anti "manos de más": se agrega a todo prompt de imagen y de animación.
export const ANATOMY_RULE =
  " Correct human anatomy: every person visible has exactly two arms and two hands, each hand with five fingers, no extra, duplicated, merged or floating hands, arms or fingers; a hand not in the frame is simply not shown.";

export const ANATOMY_MOTION =
  " Each person keeps exactly two arms and two hands throughout, no extra hands or arms appear.";

export function withAnatomy(prompt: string) {
  const p = (prompt || "").trim();
  if (!p) return p;
  return p.includes("exactly two arms") ? p : p + ANATOMY_RULE;
}

// Todo prompt de animación es VERTICAL: Flow a veces genera horizontal si no se dice con claridad.
export const VERTICAL_LEAD = "Vertical 9:16 portrait video,";
export const VERTICAL_TAIL = " Shot in vertical 9:16 portrait orientation (1080x1920), tall frame, NOT horizontal, no landscape framing, no black bars, no letterboxing.";

export function withVertical(prompt: string) {
  let p = (prompt || "").trim();
  if (!p) return p;
  if (!/^vertical\s*9:16/i.test(p)) p = `${VERTICAL_LEAD} ${p}`;
  if (!/not horizontal/i.test(p)) p += VERTICAL_TAIL;
  return p;
}

export function withAnatomyMotion(prompt: string) {
  const p = (prompt || "").trim();
  if (!p) return p;
  return withVertical(/two hands/i.test(p) ? p : p + ANATOMY_MOTION);
}
