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

// Regla "el producto no cambia de forma": se agrega a todo prompt de animación donde sale el producto.
export const PRODUCT_SHAPE =
  " The product keeps its exact shape, size, proportions, color, texture and design from the first frame to the last: it never morphs, melts, stretches, inflates, deflates, changes into a different object or gets redesigned; it moves only as a rigid object (or flexes only as much as the real material would), and any logo or label stays unchanged.";

export function withProductShape(prompt: string, showsProduct: boolean) {
  const p = (prompt || "").trim();
  if (!p || !showsProduct) return p;
  return /never morphs/i.test(p) ? p : p + PRODUCT_SHAPE;
}

export function withAnatomyMotion(prompt: string) {
  const p = (prompt || "").trim();
  if (!p) return p;
  return withVertical(/two hands/i.test(p) ? p : p + ANATOMY_MOTION);
}

// Cola de realismo para toda imagen fotográfica (no para animación, cómic, plastilina, CGI, etc.).
export const REALISM_TAIL =
  " Candid unposed snapshot look: caught mid-action, slightly imperfect off-center framing, uneven natural light, visible skin pores and fine lines, natural facial asymmetry, flyaway hairs, wrinkled everyday clothes, lived-in cluttered background, mild phone-camera grain; an ordinary person, not a model, no retouching, no beauty filter, no glossy or plastic AI skin.";

const NOT_PHOTO = /claymation|clay|stop-motion|felt|3d animated|animated feature|illustration|comic|cartoon|line art|hatching|3d cgi|cgi render|skeleton|whiteboard|infographic|chart|diagram/i;

export function withRealism(prompt: string) {
  const p = (prompt || "").trim();
  if (!p) return p;
  if (NOT_PHOTO.test(p) || !/photo|photorealistic|selfie|candid/i.test(p)) return p;
  return /unposed snapshot look/i.test(p) ? p : p + REALISM_TAIL;
}
