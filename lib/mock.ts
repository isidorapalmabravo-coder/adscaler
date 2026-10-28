import type { Analysis, Avatar, Project, VideoType } from "./types";

// Respuestas de ejemplo para el MODO DEMO (sin API keys).

export function mockAnalysis(project: Project, type: VideoType): Analysis {
  const p = project.name || "el producto";
  const look = `the real ${p} exactly as shown in the product photos`;
  const base = [
    ["Te tengo que mostrar algo que me cambió la rutina.", "front-camera selfie with arm extended, she sits in a parked car in daylight and looks at the lens with a relaxed half-smile."],
    ["Antes probé de todo y nada me funcionaba.", "photo taken by a friend, her hand pushes aside several generic unbranded products on a cluttered kitchen counter, window light."],
    [`Hasta que encontré ${p}.`, `front-camera selfie, she holds ${look} at chest height with both hands, product clearly visible and facing the camera.`],
    ["Es súper fácil de usar.", `close-up of her hands using ${look}, natural window light, her face partly visible at the top of the frame.`],
    ["Y mira el resultado.", "front-camera selfie, she smiles softly and looks at the camera, relaxed, sitting on the edge of a bed."],
    ["Está con descuento, te dejo el link abajo.", `front-camera selfie, she holds ${look} next to her face and points down with her other hand.`],
  ];
  const shots = base.map(([audio, img], i) => ({
    n: i + 1,
    time: `0:${String(i * 4).padStart(2, "0")}`,
    duration: "4 s",
    kind: type === "ugc" ? "UGC" : "B-roll",
    audio,
    imagePrompt: `Vertical 9:16 UGC photo shot on an iPhone, unretouched, raw phone-camera processing, ${img} Natural skin texture, no retouching, no filters, ordinary real home, imperfect framing.`,
    animationPrompt:
      "Handheld phone, slight natural shake. " +
      (type === "ugc" ? "She talks to the camera with natural lip sync, small natural gestures and a relaxed expression. " : "Slow natural movement of the hands and product. ") +
      "Single continuous take, no cuts, no zoom changes, no text, no subtitles, no music, 4 seconds.",
    edit: i === 0 ? "empieza directo, sin sonido" : i === 2 ? "ding suave · entra el producto" : "click suave",
  }));
  return {
    summary: `MODO DEMO: estos prompts son de ejemplo. Agrega GEMINI_API_KEY en .env.local para que la IA lea tu brief de verdad.`,
    durationSeconds: shots.length * 4,
    personaPrompt:
      type === "ugc"
        ? "Vertical 9:16 UGC selfie photo shot on an iPhone, unretouched, raw phone-camera processing, chest-up, facing the camera with a slight smile. Chilean woman, 38 years old, shoulder-length dark wavy hair, brown eyes, light freckles, plain black t-shirt. Natural skin texture, visible pores, no retouching. Plain light-grey wall behind her, no pictures, no plants, no objects, nothing in her hands, soft window light."
        : "",
    shots,
    understanding: {
      productLook: `(Demo) ${p}: la IA describirá aquí cómo se ve el producto real a partir de tus fotos.`,
      promise: "(Demo) Aquí va la idea central del anuncio.",
      tone: "(Demo) Amiga contándole a otra, ritmo rápido.",
      hook: "(Demo) Parte directo, sin saludo.",
      rules: ["(Demo) Aquí aparecerán las reglas de tu brief: lo que nunca se dice ni se muestra, zona segura, duración de clips."],
      continuity: "(Demo) Misma ropa y mismo lugar entre tomas.",
      referenceStyle: "",
    },
  };
}

export function mockAvatars(project: Project): Omit<Avatar, "id">[] {
  return [
    { name: "Carmen, 58 · “Me veo cansada en las fotos”", description: `Abuela que todavía trabaja. Le molesta cómo se ve en las fotos familiares. Desconfía de lo caro. (Ejemplo de modo demo para ${project.name}.)` },
    { name: "Paula, 42 · “No tengo tiempo para nada”", description: "Mamá de dos, trabaja todo el día. Quiere algo simple que funcione sin pasos extra." },
    { name: "Camila, 29 · “Ya probé de todo”", description: "Compra mucho online, ve muchos anuncios y está cansada de promesas. Necesita ver pruebas reales." },
  ];
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrap(text: string, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max) {
      lines.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export function mockImageSvg(prompt: string) {
  const lines = wrap(prompt.slice(0, 420), 34).slice(0, 14);
  const text = lines
    .map((l, i) => `<text x="80" y="${520 + i * 52}" font-family="monospace" font-size="34" fill="#000">${esc(l)}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
<rect width="1024" height="1536" fill="#fff"/>
<rect x="24" y="24" width="976" height="1488" fill="none" stroke="#000" stroke-width="4"/>
<text x="80" y="200" font-family="sans-serif" font-size="64" font-weight="700" fill="#000">IMAGEN DE EJEMPLO</text>
<text x="80" y="280" font-family="sans-serif" font-size="36" fill="#555">Modo demo · agrega OPENAI_API_KEY</text>
<line x1="80" y1="400" x2="944" y2="400" stroke="#000" stroke-width="2"/>
${text}
</svg>`;
}
