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

// Fisiología y lógica de cámara: se agrega a todo prompt de imagen con personas (también a los ya creados).
export const PHYSIOLOGY_RULE =
  " Anatomically correct body: natural human proportions, one head, one neck, two shoulders, two arms, two legs, ten fingers in total, each arm attached to its own shoulder, correct left and right sides, a plausible relaxed posture, no fused, bent-backwards, stretched or duplicated limbs, natural teeth and eyes.";

export const SELFIE_RULE =
  " Camera logic: the phone taking this picture is the camera itself, so it is not visible and no second phone appears; the arm holding it stays out of frame, so at most ONE free hand is visible in the shot (both hands appear only if the phone is propped on a stand or surface, and then no arm reaches toward the lens).";

const HAS_PERSON = /\b(person|woman|man|girl|boy|she|he|her|his|mother|father|lady|people|couple|friend|model)\b/i;
const IS_SELFIE = /selfie|front-camera|talking to camera|speaking to camera|to the camera/i;
const CAM_PROPPED = /propped|tripod|stand\b|on a (table|shelf|surface|counter|desk)|taken by a friend|photo taken by|over-the-shoulder|third-person/i;

export function withPhysiology(prompt: string) {
  let p = (prompt || "").trim();
  if (!p || !HAS_PERSON.test(p)) return p;
  if (!/anatomically correct body/i.test(p)) p += PHYSIOLOGY_RULE;
  if (IS_SELFIE.test(p) && !CAM_PROPPED.test(p) && !/camera logic/i.test(p)) p += SELFIE_RULE;
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

export const SELFIE_MOTION =
  " The phone filming is the camera, so it never appears in the shot and the hand holding it stays out of frame; at most one free hand is visible, and no hand or arm ever stretches toward or past the lens.";

export function withAnatomyMotion(prompt: string) {
  let p = (prompt || "").trim();
  if (!p) return p;
  if (IS_SELFIE.test(p) && !CAM_PROPPED.test(p) && !/never appears in the shot/i.test(p)) p += SELFIE_MOTION;
  return withVertical(/two hands/i.test(p) ? p : p + ANATOMY_MOTION);
}

// Cola de realismo para toda imagen fotográfica (no para animación, cómic, plastilina, CGI, etc.).
export const REALISM_TAIL =
  " Looks like a still frame from a low-quality vertical TikTok video filmed by an ordinary person on their phone: slightly soft focus, low resolution, video compression artifacts, awkward phone framing (too close, slightly tilted, off-center, something partly covering a corner), mouth half-open mid-word or eyes half-blinking, not looking perfectly at the lens, flat unflattering room light; an ordinary average-looking person, not conventionally attractive, no makeup, not posing. Candid unposed snapshot look: caught mid-action, slightly imperfect off-center framing, bright well-exposed natural daylight (never dark, dim or moody), face clearly lit, visible pores, redness around nose and cheeks, a few blemishes, faint peach fuzz, under-eye bags, dry lips, fine lines, slight JPEG compression and noise, slightly blown highlights, unretouched raw phone-camera processing, no smoothing, no glow, no beauty filter, natural facial asymmetry, flyaway hairs, wrinkled everyday clothes, lived-in cluttered background, mild phone-camera grain; a distinctive real person with their own individual face, not a model, not an influencer, no retouching, no beauty filter, no glossy or plastic AI skin.";

const NOT_PHOTO = /claymation|clay|stop-motion|felt|3d animated|animated feature|illustration|comic|cartoon|line art|hatching|3d cgi|cgi render|skeleton|whiteboard|infographic|chart|diagram/i;

export function withRealism(prompt: string) {
  const p = (prompt || "").trim();
  if (!p) return p;
  if (NOT_PHOTO.test(p) || !/photo|photorealistic|selfie|candid/i.test(p)) return p;
  return /unposed snapshot look/i.test(p) ? p : p + REALISM_TAIL;
}
