import { guardEdit } from "@/lib/auth";
import { mutate, getEdit } from "@/lib/db";
import { deleteEditFiles } from "@/lib/video-edit";
import fs from "fs";
import { filePath } from "@/lib/files";
import type { EditSlot } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  { const denied = await guardEdit(id); if (denied) return denied; }
  const job = getEdit(id);
  if (!job) return Response.json({ error: "No encontrado" }, { status: 404 });
  return Response.json(job);
}

// Guarda el orden, los textos y las opciones. Los clips ya subidos se conservan.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  { const denied = await guardEdit(id); if (denied) return denied; }
  const body = (await req.json()) as { title?: string; slots?: { id: string; text: string; manualSeconds?: number | null }[]; subtitles?: boolean; subStyle?: string; subFont?: string; kind?: string; smartTrim?: boolean; voiceOn?: boolean; voiceName?: string; voiceSpeed?: number };
  const removed: string[] = [];
  const job = mutate((db) => {
    const j = db.edits.find((e) => e.id === id);
    if (!j) return null;
    if (typeof body.title === "string") j.title = body.title.slice(0, 120) || j.title;
    if (typeof body.subtitles === "boolean") j.subtitles = body.subtitles;
    if (body.kind === "ugc" || body.kind === "broll") j.kind = body.kind;
    if (typeof body.voiceOn === "boolean") j.voiceOn = body.voiceOn;
    if (typeof body.voiceName === "string" && /^[A-Za-z]{2,20}$/.test(body.voiceName)) j.voiceName = body.voiceName;
    if (typeof body.voiceSpeed === "number" && body.voiceSpeed >= 0.5 && body.voiceSpeed <= 2) j.voiceSpeed = body.voiceSpeed;
    if (typeof body.smartTrim === "boolean") j.smartTrim = body.smartTrim;
    if (body.subFont && ["montserrat", "poppins", "bebas", "anton", "lilita"].includes(body.subFont)) j.subFont = body.subFont as typeof j.subFont;
    if (body.subStyle === "blanco" || body.subStyle === "amarillo" || body.subStyle === "caja" || body.subStyle === "cajablanca") j.subStyle = body.subStyle;
    if (Array.isArray(body.slots)) {
      const byId = new Map(j.slots.map((s) => [s.id, s]));
      const next: EditSlot[] = body.slots.slice(0, 60).map((s) => {
        const id2 = String(s.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 16) || crypto.randomUUID().slice(0, 8);
        const old = byId.get(id2);
        byId.delete(id2);
        const m = Number(s.manualSeconds);
        return { ...(old ?? { id: id2 }), id: id2, text: String(s.text ?? "").slice(0, 600), manualSeconds: m > 0 ? m : undefined };
      });
      byId.forEach((s) => s.clip && removed.push(s.clip));
      j.slots = next;
    }
    return j;
  });
  if (!job) return Response.json({ error: "No encontrado" }, { status: 404 });
  removed.forEach((f) => {
    try {
      fs.unlinkSync(filePath(f));
    } catch {}
  });
  return Response.json(job);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  { const denied = await guardEdit(id); if (denied) return denied; }
  const job = getEdit(id);
  if (job) deleteEditFiles(job);
  mutate((db) => {
    db.edits = db.edits.filter((e) => e.id !== id);
  });
  return Response.json({ ok: true });
}
