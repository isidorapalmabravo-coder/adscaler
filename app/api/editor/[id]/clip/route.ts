import { guardEdit } from "@/lib/auth";
import fs from "fs";
import path from "path";
import { mutate, getEdit } from "@/lib/db";
import { filePath, saveBuffer } from "@/lib/files";
import { probe, ffmpegProblem, speechWindow } from "@/lib/video-edit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const OK_EXT = new Set([".mp4", ".mov", ".webm", ".m4v"]);

function removeFile(name?: string) {
  if (!name) return;
  try {
    fs.unlinkSync(filePath(name));
  } catch {}
}

// Sube el clip de una toma.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  { const denied = await guardEdit(id); if (denied) return denied; }
  if (!getEdit(id)) return Response.json({ error: "No encontrado" }, { status: 404 });
  const form = await req.formData();
  const slotId = String(form.get("slot") || "");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Falta el archivo" }, { status: 400 });
  const ext = path.extname(file.name).toLowerCase();
  if (!OK_EXT.has(ext)) return Response.json({ error: "Sube un video MP4 o MOV." }, { status: 400 });

  const problem = await ffmpegProblem();
  if (problem) return Response.json({ error: problem }, { status: 500 });

  const name = saveBuffer(Buffer.from(await file.arrayBuffer()), ext);
  const info = await probe(filePath(name));
  // Si ffmpeg no pudo leer la duración, usamos la que midió el navegador
  const fromBrowser = Number(form.get("seconds") || 0);
  if (!info.seconds && fromBrowser > 0) {
    info.seconds = fromBrowser;
    info.hasAudio = true;
  }
  if (!info.seconds) {
    removeFile(name);
    return Response.json(
      { error: "No se pudo leer ese video.", detail: `Tamaño recibido: ${file.size} bytes. ffmpeg dijo: ${info.raw.replace(/\s+/g, " ").slice(0, 280)}` },
      { status: 400 }
    );
  }
  let speech: { start: number; end: number } | null = null;
  if (info.hasAudio) {
    try {
      speech = await speechWindow(filePath(name), info.seconds);
    } catch {}
  }
  let oldClip: string | undefined;
  const job = mutate((db) => {
    const j = db.edits.find((e) => e.id === id);
    const s = j?.slots.find((x) => x.id === slotId);
    if (!j || !s) return null;
    oldClip = s.clip;
    s.speechChecked = true;
    s.speechStart = speech?.start;
    s.speechEnd = speech?.end;
    s.manualSeconds = undefined;
    s.clip = name;
    s.clipName = file.name.slice(0, 120);
    s.clipSeconds = Math.round(info.seconds * 100) / 100;
    s.hasAudio = info.hasAudio;
    if (j.status === "done" || j.status === "error") j.status = "draft";
    return j;
  });
  if (!job) {
    removeFile(name);
    return Response.json({ error: "Esa toma ya no existe." }, { status: 404 });
  }
  removeFile(oldClip);
  return Response.json(job);
}

// Quita el clip de una toma.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  { const denied = await guardEdit(id); if (denied) return denied; }
  const slotId = new URL(req.url).searchParams.get("slot") || "";
  let oldClip: string | undefined;
  const job = mutate((db) => {
    const j = db.edits.find((e) => e.id === id);
    const s = j?.slots.find((x) => x.id === slotId);
    if (!j || !s) return null;
    oldClip = s.clip;
    s.clip = s.clipName = s.clipSeconds = s.hasAudio = undefined;
    return j;
  });
  removeFile(oldClip);
  if (!job) return Response.json({ error: "No encontrado" }, { status: 404 });
  return Response.json(job);
}
