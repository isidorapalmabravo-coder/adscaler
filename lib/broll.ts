/** B-roll: nadie habla ni mira a cámara. Limpia el prompt de animación y deja la regla escrita. */
export const NO_SPEAK = "Nobody speaks, lips stay closed and still, nobody looks at the camera, eyes stay on the activity.";

export function silenceBroll(animation: string) {
  let a = animation
    .replace(
      /[^.!?]*\b(speaks?|speaking|talks?|talking|says|saying|greets?|looks? (directly )?(at|into|to) (the )?(camera|lens)|looking (directly )?(at|into|to) (the )?(camera|lens)|to camera|smiles? at (the )?camera)\b[^.!?]*[.!?]?/gi,
      (m) => (/nobody|no one|does not|do not|don't|never|not speak|not look/i.test(m) ? m : "")
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!/nobody looks at the camera/i.test(a)) a = `${a} ${NO_SPEAK}`;
  return a;
}
