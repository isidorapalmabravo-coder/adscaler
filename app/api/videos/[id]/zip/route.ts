import { guardVideo } from "@/lib/auth";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { getVideo } from "@/lib/db";
import { filePath } from "@/lib/files";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  { const denied = await guardVideo(id); if (denied) return denied; }
  const video = getVideo(id);
  if (!video?.analysis) return new Response("No encontrado", { status: 404 });

  const zip = new JSZip();
  const shots = video.analysis.shots;
  const lines: string[] = [`${video.title}\n${"=".repeat(video.title.length)}\n`];

  for (const s of shots) {
    const num = String(s.n).padStart(2, "0");
    if (s.image) {
      try {
        zip.file(`toma-${num}${path.extname(s.image)}`, fs.readFileSync(filePath(s.image)));
      } catch {
        /* imagen no encontrada */
      }
    }
    lines.push(
      `TOMA ${s.n} · ${s.time} · ${s.duration} · ${s.kind}`,
      `Audio: ${s.audio}`,
      `Prompt de animación (Flow):\n${s.animationPrompt}`,
      `Edición: ${s.edit}`,
      ""
    );
  }
  if (video.personaChosen) {
    try {
      zip.file(`personaje${path.extname(video.personaChosen)}`, fs.readFileSync(filePath(video.personaChosen)));
    } catch {}
  }
  zip.file("prompts-de-animacion.txt", lines.join("\n"));

  const buf = await zip.generateAsync({ type: "uint8array" });
  const safe = video.title.replace(/[^a-z0-9áéíóúñ -]/gi, "").trim().replace(/\s+/g, "-") || "video";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(safe)}.zip"`,
    },
  });
}
