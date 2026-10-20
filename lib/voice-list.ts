/** Voces de Gemini TTS. Todas hablan español; el acento chileno se pide en la instrucción. */
export const VOICES = [
  { id: "Kore", label: "Mujer · firme y clara", gender: "f" },
  { id: "Leda", label: "Mujer · joven y cercana", gender: "f" },
  { id: "Zephyr", label: "Mujer · luminosa", gender: "f" },
  { id: "Puck", label: "Hombre · animado", gender: "m" },
  { id: "Orus", label: "Hombre · seguro", gender: "m" },
  { id: "Charon", label: "Hombre · calmado", gender: "m" },
] as const;

export const DEFAULT_VOICE = "Kore";
export const SAMPLE_TEXT = "¿Te pasa que te pones base y a las dos horas ya se ve toda corrida? Mira esto, de verdad cambió mi rutina.";
