import { guardEdit } from "@/lib/auth";
import fs from "fs";
import { mutate, getEdit } from "@/lib/db";
import { filePath } from "@/lib/files";
import { ffmpegProblem } from "@/lib/video-edit";
import { synthesize, retime, clampSpeed } from "@/lib/voice";
import { SAMPLE_TEXT, VOICES, DEFAULT_VOICE } from "@/lib/voice-list";
import { pool } from "@/lib/images";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const rm = (f?: string) => {
  if (!f) return;
  try {
    fs.unlinkSync(filePath(f));
  } catch {}
};

/**
 * Crea la voz en off con Gemini.
 * { sample: true, voiceName }  → una frase de prueba para escuchar la voz
 * { slotId }                   → regenera la voz de una toma
 * {} (nada)                    → genera las que faltan o cambiaron de texto
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  { const denied = await guardEdit(id); if (denied) return denied; }
  const job = getEdit(id);
  if (!job) return Response.json({ error: "No encontrado" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { sample?: boolean; voiceName?: string; slotId?: string; force?: boolean; speed?: number };
  const problem = await ffmpegProblem();
  if (problem) return Response.json({ error: problem }, { status: 500 });

  const voiceName = VOICES.some((v) => v.id === (body.voiceName ?? job.voiceName)) ? ((body.voiceName ?? job.voiceName) as string) : DEFAULT_VOICE;

  const speed = clampSpeed(body.speed ?? job.voiceSpeed);

  try {
    if (body.sample) {
      const r = await synthesize(SAMPLE_TEXT, voiceName, speed);
      return Response.json({ file: r.file, seconds: r.seconds });
    }

    const todo = job.slots.filter((s) => {
      const t = s.text.trim();
      if (!t) return false;
      if (body.slotId) return s.id === body.slotId;
      return body.force || !s.voice || s.voiceText !== t || s.voiceName !== voiceName;
    });
    const errors: string[] = [];
    const results = await pool(todo, 3, async (s) => {
      try {
        const r = await synthesize(s.text.trim(), voiceName, speed);
        return { id: s.id, text: s.text.trim(), ...r };
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
        return null;
      }
    });
    // voces ya creadas con otra velocidad: se ajustan sin volver a llamar a la IA
    const redo = new Map<string, { file: string; seconds: number }>();
    if (!body.slotId) {
      const fresh = new Set(results.filter(Boolean).map((r) => r!.id));
      await pool(job.slots.filter((s) => s.voice && s.voiceSeconds && !fresh.has(s.id) && Math.abs((s.voiceSpeed ?? 1) - speed) > 0.01), 3, async (s) => {
        try {
          redo.set(s.id, await retime(s.voice!, speed / (s.voiceSpeed ?? 1)));
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      });
    }
    const old: string[] = [];
    const next = mutate((db) => {
      const j = db.edits.find((e) => e.id === id)!;
      j.voiceName = voiceName;
      j.voiceSpeed = speed;
      for (const [sid, r] of redo) {
        const s = j.slots.find((x) => x.id === sid);
        if (!s) continue;
        if (s.voice) old.push(s.voice);
        s.voice = r.file;
        s.voiceSeconds = r.seconds;
        s.voiceSpeed = speed;
      }
      for (const r of results) {
        if (!r) continue;
        const s = j.slots.find((x) => x.id === r.id);
        if (!s) {
          old.push(r.file);
          continue;
        }
        if (s.voice) old.push(s.voice);
        s.voice = r.file;
        s.voiceSeconds = r.seconds;
        s.voiceText = r.text;
        s.voiceName = voiceName;
        s.voiceSpeed = speed;
      }
      return j;
    });
    old.forEach(rm);
    if (errors.length && !results.some(Boolean) && !redo.size) return Response.json({ error: errors[0] }, { status: 500 });
    return Response.json({ job: next, failed: errors.length });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
