export type VideoType = "ugc" | "broll";

// B-roll se divide en 4 clases (el "mode" solo existe cuando type = "broll")
export type BrollMode = "persona" | "cortes" | "animado_personaje" | "animado_cortes";

export const MODE_LABEL: Record<BrollMode, string> = {
  persona: "B-roll · una persona fija",
  cortes: "B-roll · cortes variados",
  animado_personaje: "Animado · un personaje fijo",
  animado_cortes: "Animado · cortes variados",
};

/** ¿El video tiene una persona o personaje fijo que hay que crear y aprobar? */
export const hasCharacter = (type: VideoType, mode?: BrollMode) =>
  type === "ugc" || mode === "persona" || mode === "animado_personaje";

/** ¿Es animado (3D, clay, tela, pizarra...)? */
export const isAnimated = (type: VideoType, mode?: BrollMode) =>
  type === "broll" && (mode === "animado_personaje" || mode === "animado_cortes");

export type VideoStatus =
  | "draft" // creado, falta analizar
  | "analyzed" // la IA ya escribió los prompts → aprobar personaje
  | "persona_approved" // personaje aprobado → aprobar primera toma
  | "done"; // todas las tomas generadas → entrega

export interface Avatar {
  id: string;
  name: string;
  description: string;
}

export interface Project {
  id: string;
  ownerId?: string;
  name: string;
  description: string;
  offer: string;
  never: string;
  photos: string[]; // nombres de archivo en data/uploads
  avatars: Avatar[];
  createdAt: string;
}

export interface Shot {
  n: number;
  time: string; // "0:00"
  duration: string; // "3,5 s"
  kind: string; // UGC, B-roll, producto, cómic…
  audio: string;
  imagePrompt: string;
  animationPrompt: string;
  edit: string; // sonido / edición
  showsCharacter?: boolean; // ¿en esta toma se ve a la persona o personaje fijo? (según la columna VISUAL del brief)
  showsProduct?: boolean; // ¿en esta toma se ve el producto?
  image?: string; // archivo generado
}

// Lo que la IA entendió del brief ANTES de escribir los prompts (paso 1 del cerebro)
export interface Understanding {
  productLook: string; // cómo se ve el producto real, según las fotos
  promise: string; // promesa / idea central del anuncio
  tone: string; // tono y ritmo
  hook: string; // cómo parte el video
  rules: string[]; // lo que el brief prohíbe o exige
  continuity: string; // ropa, lugar y luz que deben repetirse entre tomas
  referenceStyle: string; // qué hacen los videos de referencia (vacío si no hay)
}

export interface Analysis {
  summary: string;
  durationSeconds: number;
  personaPrompt: string;
  shots: Shot[];
  understanding?: Understanding;
}

export interface Video {
  id: string;
  projectId: string;
  title: string;
  type: VideoType;
  mode?: BrollMode;
  animStyle?: string; // estilo de animación, texto libre (solo videos animados)
  avatarId: string | null;
  briefName: string;
  briefText: string;
  refVideos: string[];
  notes: string;
  status: VideoStatus;
  analysis?: Analysis;
  personaImages: string[];
  personaChosen?: string;
  error?: string;
  /** Momento en que empezó el análisis del brief (mientras corre en segundo plano). */
  analyzingSince?: string;
  createdAt: string;
}

/** Editor de video: une los clips de Flow en orden, con subtítulos. */
export interface EditSlot {
  id: string;
  text: string; // lo que se dice en esa toma (guion)
  clip?: string; // archivo subido (data/uploads)
  clipName?: string;
  clipSeconds?: number;
  hasAudio?: boolean;
  speechStart?: number; // dónde empieza a hablarse en el clip (segundos), si se detectó voz
  speechEnd?: number; // dónde termina de hablarse
  speechChecked?: boolean; // ya se analizó el audio
  manualSeconds?: number; // largo que fijó la persona (anula el recorte automático)
  voice?: string; // voz en off generada (data/uploads)
  voiceSeconds?: number; // cuánto dura exactamente esa voz
  voiceName?: string; // con qué voz se generó
  voiceSpeed?: number; // velocidad aplicada a este audio (1 = normal)
  voiceText?: string; // texto con el que se generó (si el texto cambia, hay que regenerar)
}

export type EditKind = "ugc" | "broll";
export type SubFont = "montserrat" | "poppins" | "bebas" | "anton" | "lilita";

export type EditStatus = "draft" | "rendering" | "done" | "error";

export interface EditJob {
  id: string;
  ownerId?: string;
  title: string;
  videoId?: string; // video de la app del que salió el guion
  slots: EditSlot[];
  kind?: EditKind; // ugc: la persona habla dentro del clip · broll: voz en off sobre las imágenes
  smartTrim?: boolean; // recorte inteligente (por defecto sí)
  subtitles: boolean;
  subStyle: "blanco" | "amarillo" | "caja" | "cajablanca"; // caja = texto blanco sobre recuadro negro semitransparente
  subFont?: SubFont;
  voiceOn?: boolean; // poner la voz en off generada por la web (B-roll)
  voiceName?: string; // voz de Gemini (Kore, Puck…)
  voiceSpeed?: number; // velocidad de la voz: 1 normal, 1.25 rápida, 1.4 muy rápida
  status: EditStatus;
  progress?: number; // 0 a 100 mientras se crea
  renderStartedAt?: string;
  stage?: string; // en qué paso va la creación del video
  output?: string;
  outputSeconds?: number;
  error?: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  passHash: string; // scrypt
  salt: string;
  role: "admin" | "user";
  plan: string; // nombre del plan (se cambia a mano hasta tener pagos)
  imageLimit: number; // imágenes al mes
  planUntil?: string; // hasta cuándo vale el plan pagado (AAAA-MM-DD...). Si pasó, vuelve al cupo gratis
  credits?: number; // imágenes sueltas compradas en packs o en el video de prueba (no vencen)
  trialUsed?: boolean; // ya compró su video de prueba
  disabled?: boolean;
  createdAt: string;
}

export interface DB {
  users: User[];
  projects: Project[];
  videos: Video[];
  imageLog: { at: string; userId?: string }[];
  edits: EditJob[];
  pagos?: Pago[];
}

/** Un pago aprobado en Mercado Pago. */
export interface Pago {
  id: string; // id del pago en Mercado Pago
  userId: string;
  kind: "plan" | "pack" | "prueba";
  item: string;
  amount: number;
  at: string;
}
