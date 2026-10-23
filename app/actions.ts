"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getProject, getVideo, mutate, newId } from "@/lib/db";
import { requireUser, ownProject, ownVideo } from "@/lib/auth";
import { filesFrom, saveUpload } from "@/lib/files";
import { briefToText } from "@/lib/brief";
import { analyzeBrief, rewriteAnimation, suggestAvatars } from "@/lib/gemini";
import { withVertical } from "@/lib/anatomy";
import { generateImage, pool, type Quality, type Ref } from "@/lib/images";
import { NEUTRAL_BACKGROUND, NEUTRAL_BACKGROUND_ANIMATED, referencePreamble, productReminder } from "@/lib/prompts";
import { hasCharacter, isAnimated, type BrollMode, type Project, type Shot, type Video, type VideoStatus } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function updateVideo(id: string, fn: (v: Video) => void) {
  mutate((db) => {
    const v = db.videos.find((x) => x.id === id);
    if (v) fn(v);
  });
}

function updateProjectDb(id: string, fn: (p: Project) => void) {
  mutate((db) => {
    const p = db.projects.find((x) => x.id === id);
    if (p) fn(p);
  });
}

/* ---------------- Proyectos ---------------- */

export async function createProject(form: FormData) {
  const me = await requireUser();
  const photos = await Promise.all(filesFrom(form, "photos").map(saveUpload));
  const id = newId();
  mutate((db) => {
    db.projects.unshift({
      id,
      ownerId: me.id,
      name: str(form, "name") || "Producto sin nombre",
      description: str(form, "description"),
      offer: str(form, "offer"),
      never: str(form, "never"),
      photos,
      avatars: [],
      createdAt: new Date().toISOString(),
    });
  });
  redirect(`/proyectos/${id}`);
}

export async function updateProject(id: string, form: FormData) {
  ownProject(await requireUser(), id);
  const photos = await Promise.all(filesFrom(form, "photos").map(saveUpload));
  updateProjectDb(id, (p) => {
    p.name = str(form, "name") || p.name;
    p.description = str(form, "description");
    p.offer = str(form, "offer");
    p.never = str(form, "never");
    p.photos.push(...photos);
  });
  revalidatePath(`/proyectos/${id}`);
}

export async function removePhoto(id: string, photo: string) {
  ownProject(await requireUser(), id);
  updateProjectDb(id, (p) => {
    p.photos = p.photos.filter((x) => x !== photo);
  });
  revalidatePath(`/proyectos/${id}`);
}

export async function addAvatar(id: string, form: FormData) {
  ownProject(await requireUser(), id);
  const name = str(form, "name");
  if (!name) return;
  updateProjectDb(id, (p) => {
    p.avatars.push({ id: newId(), name, description: str(form, "description") });
  });
  revalidatePath(`/proyectos/${id}`);
}

export async function generateAvatars(id: string) {
  ownProject(await requireUser(), id);
  const project = getProject(id);
  if (!project) return;
  const list = await suggestAvatars(project);
  updateProjectDb(id, (p) => {
    p.avatars.push(...list.map((a) => ({ ...a, id: newId() })));
  });
  revalidatePath(`/proyectos/${id}`);
}

export async function deleteAvatar(id: string, avatarId: string) {
  ownProject(await requireUser(), id);
  updateProjectDb(id, (p) => {
    p.avatars = p.avatars.filter((a) => a.id !== avatarId);
  });
  revalidatePath(`/proyectos/${id}`);
}

/* ---------------- Videos ---------------- */

async function runAnalysis(videoId: string) {
  const video = getVideo(videoId)!;
  const project = getProject(video.projectId)!;
  const avatar = project.avatars.find((a) => a.id === video.avatarId) ?? null;
  try {
    const analysis = await analyzeBrief({
      project,
      avatar,
      type: video.type,
      mode: video.mode,
      animStyle: video.animStyle,
      briefText: video.briefText,
      notes: video.notes,
      refVideos: video.refVideos,
    });
    updateVideo(videoId, (v) => {
      v.analysis = analysis;
      v.error = undefined;
      v.analyzingSince = undefined;
      // Sin personaje fijo (B-roll de cortes) se salta directo a la primera toma
      v.status = hasCharacter(v.type, v.mode) ? "analyzed" : "persona_approved";
    });
  } catch (e) {
    updateVideo(videoId, (v) => {
      v.error = `No se pudo analizar el brief: ${errMsg(e)}`;
      v.analyzingSince = undefined;
    });
  }
}

/** Marca el video como "analizando" y corre el análisis en segundo plano: la página no queda colgada esperando a la IA. */
function startAnalysis(videoId: string) {
  updateVideo(videoId, (v) => {
    v.analyzingSince = new Date().toISOString();
    v.error = undefined;
  });
  after(() => runAnalysis(videoId));
}

export async function createVideo(projectId: string, form: FormData) {
  ownProject(await requireUser(), projectId);
  const briefFile = filesFrom(form, "brief")[0];
  const pasted = str(form, "briefText");
  let briefText = pasted;
  let failed = "";
  if (briefFile) {
    try {
      briefText = await briefToText(briefFile);
    } catch (e) {
      failed = `No se pudo leer el archivo del brief (${errMsg(e)}). Prueba subirlo como .txt o .md, o pégalo en el cuadro.`;
    }
  }
  if (!failed && !briefText.trim()) failed = "Falta el brief: sube un archivo o pégalo en el cuadro.";
  if (failed) redirect(`/proyectos/${projectId}/videos/nuevo?error=${encodeURIComponent(failed)}`);
  const refVideos: string[] = [];
  const id = newId();
  const type = str(form, "type") === "broll" ? "broll" : "ugc";
  const modeRaw = str(form, "mode");
  const mode: BrollMode | undefined =
    type === "broll"
      ? (["persona", "cortes", "animado_personaje", "animado_cortes"].includes(modeRaw) ? (modeRaw as BrollMode) : "cortes")
      : undefined;
  mutate((db) => {
    db.videos.unshift({
      id,
      projectId,
      title: str(form, "title") || "Video sin título",
      type,
      mode,
      animStyle: isAnimated(type, mode) ? str(form, "animStyleCustom") || str(form, "animStyle") || undefined : undefined,
      avatarId: str(form, "avatarId") || null,
      briefName: briefFile?.name ?? (pasted ? "Texto pegado" : ""),
      briefText,
      refVideos,
      notes: str(form, "notes"),
      status: "draft",
      personaImages: [],
      createdAt: new Date().toISOString(),
    });
  });
  startAnalysis(id);
  redirect(`/videos/${id}`);
}

export async function reanalyze(videoId: string) {
  ownVideo(await requireUser(), videoId);
  startAnalysis(videoId);
  revalidatePath(`/videos/${videoId}`);
}

export async function setStatus(videoId: string, status: VideoStatus) {
  ownVideo(await requireUser(), videoId);
  updateVideo(videoId, (v) => {
    v.status = status;
  });
  revalidatePath(`/videos/${videoId}`);
}

// Borra un video sin salir de la página (para el basurero de las tablas)
export async function deleteVideoQuiet(videoId: string) {
  ownVideo(await requireUser(), videoId);
  mutate((db) => {
    db.videos = db.videos.filter((v) => v.id !== videoId);
  });
  revalidatePath("/");
  revalidatePath("/videos");
  revalidatePath("/proyectos/[id]", "page");
}

export async function deleteVideo(videoId: string) {
  ownVideo(await requireUser(), videoId);
  const video = getVideo(videoId);
  mutate((db) => {
    db.videos = db.videos.filter((v) => v.id !== videoId);
  });
  redirect(video ? `/proyectos/${video.projectId}` : "/");
}

/* ---------------- Paso 2: personaje ---------------- */

export async function generatePersonas(videoId: string, form: FormData) {
  const me = await requireUser();
  ownVideo(me, videoId);
  const tweak = str(form, "tweak");
  let prompt = str(form, "personaPrompt");
  if (tweak) prompt += ` Adjustment: ${tweak}.`;
  updateVideo(videoId, (v) => {
    if (v.analysis) v.analysis.personaPrompt = prompt;
    v.error = undefined;
  });
  try {
    // Fondo neutro y liso: así el fondo del personaje no se "filtra" a las demás tomas
    const vid = getVideo(videoId);
    const bg = vid && isAnimated(vid.type, vid.mode) ? NEUTRAL_BACKGROUND_ANIMATED : NEUTRAL_BACKGROUND;
    // Realista: se quita el fondo liso de estudio de versiones anteriores y se pone un rincón de casa natural
    let base = prompt;
    if (vid && !isAnimated(vid.type, vid.mode)) {
      base = base.replace(/[^.]*\b(plain|blank|solid|neutral|studio)\b[^.]*\b(wall|background|backdrop)\b[^.]*\.?/gi, "").trim();
      if (!/no beauty filter/i.test(base)) base += " Natural skin texture, visible pores, uneven skin tone, flyaway hairs, small asymmetries, no retouching, no beauty filter, phone-camera grain.";
    }
    const withBg = base + bg;
    const imgs = await pool([1, 2], 2, () => generateImage(withBg, [], { userId: me.id }));
    updateVideo(videoId, (v) => {
      v.personaImages = [...imgs, ...v.personaImages];
    });
  } catch (e) {
    updateVideo(videoId, (v) => {
      v.error = `No se pudieron generar las imágenes: ${errMsg(e)}`;
    });
  }
  revalidatePath(`/videos/${videoId}`);
}

export async function approvePersona(videoId: string, form: FormData) {
  ownVideo(await requireUser(), videoId);
  const chosen = str(form, "chosen");
  if (!chosen) return;
  updateVideo(videoId, (v) => {
    v.personaChosen = chosen;
    v.status = "persona_approved";
  });
  revalidatePath(`/videos/${videoId}`);
}

/* ---------------- Paso 3 y 4: tomas ---------------- */

// Cuántas fotos del producto se envían como referencia (cada una cuesta). La primera es la principal.
const MAX_PRODUCT_REFS = Number(process.env.MAX_PRODUCT_REFS || 1);

// La foto real del producto se adjunta si la toma está marcada con producto, si es de tipo "producto"
// o si el prompt menciona el producto (para que nunca se pierda por un error de marcado).
function wantsProduct(shot: Shot, name: string) {
  if (shot.showsProduct === true || /producto|product/i.test(shot.kind ?? "")) return true;
  // Si la toma está marcada SIN producto (por ejemplo el gancho del problema), nunca se adjunta su foto.
  // Antes se revisaba el texto del prompt, pero frases como "No product, no logos" lo reactivaban por error.
  if (shot.showsProduct === false) return false;
  return true;
}

// Solo se adjunta la referencia de lo que SE VE en esa toma: la persona y el producto no aparecen en todas
function refsFor(video: Video, shot?: Shot): Ref[] {
  const project = getProject(video.projectId)!;
  const refs: Ref[] = [];
  if (video.personaChosen && hasCharacter(video.type, video.mode) && shot?.showsCharacter !== false)
    refs.push({ file: video.personaChosen, kind: "persona" });
  if (shot && wantsProduct(shot, project.name)) {
    for (const photo of project.photos.slice(0, MAX_PRODUCT_REFS)) refs.push({ file: photo, kind: "product" });
  }
  return refs;
}

async function renderShot(video: Video, shot: Shot, quality?: Quality, userId?: string) {
  const refs = refsFor(video, shot);
  const look = video.analysis?.understanding?.productLook;
  const preamble = referencePreamble({
    persona: refs.some((r) => r.kind === "persona"),
    animated: isAnimated(video.type, video.mode),
    products: refs.filter((r) => r.kind === "product").length,
    productLook: look && !look.startsWith("(Demo)") ? look : undefined,
  });
  const file = await generateImage(preamble + shot.imagePrompt + productReminder(refs.filter((r) => r.kind === "product").length), refs, { quality, userId });
  updateVideo(video.id, (v) => {
    const s = v.analysis?.shots.find((x) => x.n === shot.n);
    if (s) s.image = file;
  });
}

export async function saveShot(videoId: string, n: number, form: FormData) {
  ownVideo(await requireUser(), videoId);
  updateVideo(videoId, (v) => {
    const s = v.analysis?.shots.find((x) => x.n === n);
    if (!s) return;
    s.imagePrompt = str(form, "imagePrompt") || s.imagePrompt;
    s.animationPrompt = withVertical(str(form, "animationPrompt") || s.animationPrompt);
    if (form.has("flags")) {
      s.showsCharacter = form.has("showsCharacter");
      s.showsProduct = form.has("showsProduct");
    }
  });
}

export async function generateShot(videoId: string, n: number, form: FormData) {
  const me = await requireUser();
  ownVideo(me, videoId);
  if (form.has("imagePrompt")) await saveShot(videoId, n, form);
  const tweak = str(form, "tweak");
  const video = getVideo(videoId)!;
  const shot = video.analysis?.shots.find((s) => s.n === n);
  if (!shot) return;
  const prompt = tweak ? `${shot.imagePrompt} Adjustment: ${tweak}.` : shot.imagePrompt;
  // Casilla "mayor calidad": usa calidad media (gasta 3 créditos en vez de 1)
  const quality: Quality | undefined = form.get("hq") ? "medium" : undefined;
  try {
    await renderShot(video, { ...shot, imagePrompt: prompt }, quality, me.id);
    updateVideo(videoId, (v) => {
      v.error = undefined;
    });
  } catch (e) {
    updateVideo(videoId, (v) => {
      v.error = `No se pudo generar la toma ${n}: ${errMsg(e)}`;
    });
  }
  revalidatePath(`/videos/${videoId}`);
}

export async function approveFirstShot(videoId: string) {
  const me = await requireUser();
  ownVideo(me, videoId);
  const video = getVideo(videoId)!;
  const pending = (video.analysis?.shots ?? []).filter((s) => !s.image);
  const failed: number[] = [];
  await pool(pending, 3, async (s) => {
    try {
      await renderShot(video, s, undefined, me.id);
    } catch {
      failed.push(s.n);
    }
  });
  updateVideo(videoId, (v) => {
    v.status = "done";
    v.error = failed.length
      ? `No se pudieron generar las tomas ${failed.sort((a, b) => a - b).join(", ")}. Usa "Regenerar" en cada una.`
      : undefined;
  });
  revalidatePath(`/videos/${videoId}`);
}

// Regenera SOLO el prompt de animación de una toma (en la pantalla de entrega)
export async function regenerateAnimation(videoId: string, n: number, form: FormData) {
  ownVideo(await requireUser(), videoId);
  const video = getVideo(videoId);
  const shot = video?.analysis?.shots.find((s) => s.n === n);
  if (!video || !video.analysis || !shot) return;
  const project = getProject(video.projectId)!;
  const avatar = project.avatars.find((x) => x.id === video.avatarId) ?? null;
  try {
    const animationPrompt = await rewriteAnimation({
      project,
      avatar,
      type: video.type,
      mode: video.mode,
      animStyle: video.animStyle,
      personaPrompt: video.analysis.personaPrompt,
      productLook: video.analysis.understanding?.productLook ?? "",
      shot,
      change: str(form, "change"),
    });
    updateVideo(videoId, (v) => {
      const s = v.analysis?.shots.find((x) => x.n === n);
      if (s) s.animationPrompt = animationPrompt;
      v.error = undefined;
    });
  } catch (e) {
    updateVideo(videoId, (v) => {
      v.error = `No se pudo regenerar el prompt de la toma ${n}: ${errMsg(e)}`;
    });
  }
  revalidatePath(`/videos/${videoId}`);
}

// Cambia el nombre de un video (desde "Todos los videos", el producto o la página del video)
export async function renameVideo(videoId: string, title: string) {
  ownVideo(await requireUser(), videoId);
  const t = title.trim().slice(0, 120);
  if (!t) return;
  mutate((db) => {
    const v = db.videos.find((x) => x.id === videoId);
    if (v) v.title = t;
  });
  revalidatePath("/");
  revalidatePath("/videos");
  revalidatePath(`/videos/${videoId}`);
  revalidatePath("/proyectos/[id]", "page");
}
