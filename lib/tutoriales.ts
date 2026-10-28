export const DRIVE_DOCS = "https://drive.google.com/drive/folders/1lgV0yDYUpDvXFqEgW11sGyjleasmw23v?usp=drive_link";

export interface Tutorial {
  slug: string;
  t: string; // título
  d: string; // resumen corto (tarjeta)
  link: string; // enlace de YouTube (no listado)
  intro: string; // texto de la página del tutorial
  bullets: string[]; // "En este video ves"
  method?: boolean; // muestra el método guardado en esta página
}

export const TUTORIALES: Tutorial[] = [
  {
    slug: "bienvenida",
    t: "Tutorial 1 · Bienvenida",
    d: "Qué es la web, proyectos, el editor, dónde se guardan los videos, los planes y el método para el brief.",
    link: "https://youtu.be/2GPLsfqjJ2w?si=e6nL6cbMIiT-TKNe",
    intro: "Tutorial de Adscaler: cómo crear anuncios en video con IA, paso a paso.",
    bullets: [
      "Qué es Adscaler y cómo funcionan los proyectos",
      "Cómo usar el método (el archivo markdown) con ChatGPT para armar tu brief",
      "Cómo generar las imágenes y los prompts de animación para Flow",
      "Cómo usar el editor para unir tus clips, con subtítulos",
      "Dónde se guardan tus videos y cómo funcionan los planes",
    ],
    method: true,
  },
  {
    slug: "ugc",
    t: "Tutorial 2 · UGC",
    d: "Cómo funciona un video con una persona hablando a cámara.",
    link: "https://youtu.be/oUoAQW6hX_A?si=02_p2t48kjgKn7ry",
    intro: "Cómo crear un anuncio UGC: una persona real hablando a cámara, como si grabara con su celular.",
    bullets: [
      "Cómo elegir y aprobar a la persona que sale en tu video",
      "Cómo generar la imagen de cada toma",
      "Cómo pasar cada imagen y su prompt de animación a Flow",
      "Cómo unir los clips en el editor, con corte justo cuando termina de hablar y subtítulos",
    ],
  },
  {
    slug: "b-roll",
    t: "Tutorial 3 · B-roll",
    d: "Planos de producto con voz en off.",
    link: "https://youtu.be/PiAcl4REsRI?si=51bJWnuKX0OG9znk",
    intro: "Cómo crear un anuncio B-roll: planos de tu producto con una voz en off, sin que nadie hable a cámara.",
    bullets: [
      "Cómo armar el brief de un anuncio B-roll",
      "Cómo generar las imágenes de cada toma y los prompts de animación para Flow",
      "Cómo crear la voz en off con IA, con acento chileno",
      "Cómo el editor une tus clips, corta justo cuando termina cada frase y pone subtítulos",
      "Que el sonido original de Flow se silencia y solo se escucha la voz en off",
    ],
  },
  {
    slug: "editor",
    t: "Tutorial 4 · Editor",
    d: "Une los clips de Flow, subtítulos y texto sobre el video.",
    link: "https://youtu.be/1Ow8toKjz44?si=NKJcqPEzUML3-jgW",
    intro: "Cómo usar el editor de video de Adscaler para convertir tus clips de Flow en el anuncio final.",
    bullets: [
      "Cómo subir los clips y ordenarlos por el nombre del archivo",
      "Cómo funciona el corte inteligente",
      "Cómo elegir la fuente y el estilo de los subtítulos",
      "Cómo poner un texto propio sobre cada toma",
      "Cómo descargar tu video en MP4",
    ],
  },
];

export function videoId(link?: string): string | null {
  if (!link) return null;
  try {
    const u = new URL(link.trim());
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") return u.pathname.slice(1) || null;
    if (h === "youtube.com" || h === "m.youtube.com") return u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop() || null;
  } catch {}
  return null;
}
