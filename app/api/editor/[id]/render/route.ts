import { guardEdit } from "@/lib/auth";
import { after } from "next/server";
import { mutate, getEdit } from "@/lib/db";
import { enqueueRender, ffmpegProblem } from "@/lib/video-edit";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  { const denied = await guardEdit(id); if (denied) return denied; }
  const job = getEdit(id);
  if (!job) return Response.json({ error: "No encontrado" }, { status: 404 });
  if (!job.slots.some((s) => s.clip)) return Response.json({ error: "Sube al menos un clip." }, { status: 400 });
  const problem = await ffmpegProblem();
  if (problem) return Response.json({ error: problem }, { status: 500 });
  if (job.status === "rendering" && job.renderStartedAt && Date.now() - new Date(job.renderStartedAt).getTime() < 30 * 60000) {
    return Response.json(job);
  }
  const next = mutate((db) => {
    const j = db.edits.find((e) => e.id === id)!;
    j.status = "rendering";
    j.progress = 0;
    j.error = undefined;
    j.renderStartedAt = new Date().toISOString();
    j.queued = undefined;
    return j;
  });
  after(() => enqueueRender(id));
  return Response.json(next);
}
