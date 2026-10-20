"use server";
import { requireAdmin } from "@/lib/auth";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { runCompare, readCompare, writeCompare } from "@/lib/compare";
import { getProject, getVideo } from "@/lib/db";
import { generateImage, pool, type Ref } from "@/lib/images";
import { referencePreamble } from "@/lib/prompts";
import { hasCharacter, isAnimated } from "@/lib/types";

export async function startCompare(videoId: string) {
  await requireAdmin();
  after(() => runCompare(videoId));
  revalidatePath(`/comparar/${videoId}`);
}

/** Genera la imagen de una toma con el prompt de Pro y con el de Flash-Lite, para compararlas con los ojos. */
export async function compareImage(videoId: string, n: number) {
  await requireAdmin();
  const video = getVideo(videoId);
  const c = readCompare(videoId);
  if (!video || !c) return;
  const project = getProject(video.projectId);
  await pool(c.runs, 2, async (run) => {
    const shot = run.analysis?.shots.find((s) => s.n === n);
    if (!shot) return;
    const refs: Ref[] = [];
    // Igual que en la app: persona y producto solo si se ven en esa toma
    if (video.personaChosen && hasCharacter(video.type, video.mode) && shot.showsCharacter !== false) refs.push({ file: video.personaChosen, kind: "persona" });
    if (shot.showsProduct !== false && project) for (const f of project.photos.slice(0, Number(process.env.MAX_PRODUCT_REFS || 1))) refs.push({ file: f, kind: "product" });
    const look = run.analysis?.understanding?.productLook;
    const preamble = referencePreamble({
      persona: refs.some((r) => r.kind === "persona"),
      animated: isAnimated(video.type, video.mode),
      products: refs.filter((r) => r.kind === "product").length,
      productLook: look && !look.startsWith("(Demo)") ? look : undefined,
    });
    try {
      const file = await generateImage(preamble + shot.imagePrompt, refs);
      const fresh = readCompare(videoId);
      const r = fresh?.runs.find((x) => x.key === run.key);
      if (fresh && r) {
        r.images = { ...(r.images ?? {}), [String(n)]: file };
        writeCompare(videoId, fresh);
      }
    } catch (e) {
      console.error("[plano] comparar imagen:", e);
    }
  });
  revalidatePath(`/comparar/${videoId}`);
}
