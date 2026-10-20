import fs from "fs";
import path from "path";
import { DATA_DIR, getProject, getVideo } from "./db";
import { analyzeBrief } from "./gemini";
import type { Analysis } from "./types";

export const PRO = "gemini-3.1-pro-preview";
export const LITE = process.env.GEMINI_COMPARE_LITE || "gemini-3.1-flash-lite";

// US$ por millón de tokens (precios de Google, prompts de hasta 200k)
const PRICE: Record<string, [number, number]> = {
  [PRO]: [2, 12],
  [LITE]: [0.25, 1.5],
};
export const FX = 950;

export interface Usage {
  step: string;
  model: string;
  tin: number;
  tout: number;
}
export interface Run {
  key: "pro" | "lite";
  label: string;
  status: "waiting" | "running" | "done" | "error";
  analysis?: Analysis;
  error?: string;
  usage: Usage[];
  seconds?: number;
  images?: Record<string, string>; // imagen generada de cada toma (n → archivo)
}
export interface Compare {
  videoId: string;
  startedAt: string;
  runs: Run[];
}

const file = (id: string) => path.join(DATA_DIR, `compare-${id.replace(/[^a-z0-9-]/gi, "")}.json`);

export function readCompare(id: string): Compare | null {
  try {
    return JSON.parse(fs.readFileSync(file(id), "utf8"));
  } catch {
    return null;
  }
}
export function writeCompare(id: string, c: Compare) {
  write(id, c);
}
function write(id: string, c: Compare) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file(id), JSON.stringify(c));
}

export const costClp = (u: Usage) => {
  const [pin, pout] = PRICE[u.model] ?? PRICE[PRO];
  return ((u.tin * pin + u.tout * pout) / 1e6) * FX;
};

/** Analiza el mismo video con Pro y con Flash-Lite y guarda los dos resultados. */
export async function runCompare(videoId: string) {
  const video = getVideo(videoId);
  if (!video) return;
  const project = getProject(video.projectId)!;
  const avatar = project.avatars.find((a) => a.id === video.avatarId) ?? null;
  const c: Compare = {
    videoId,
    startedAt: new Date().toISOString(),
    runs: [
      { key: "pro", label: "Gemini 3.1 Pro (hoy)", status: "waiting", usage: [] },
      { key: "lite", label: "Gemini Flash-Lite", status: "waiting", usage: [] },
    ],
  };
  write(videoId, c);
  for (const run of c.runs) {
    run.status = "running";
    write(videoId, c);
    const model = run.key === "pro" ? PRO : LITE;
    const t0 = Date.now();
    try {
      run.analysis = await analyzeBrief({
        project,
        avatar,
        type: video.type,
        mode: video.mode,
        animStyle: video.animStyle,
        briefText: video.briefText,
        notes: video.notes,
        refVideos: video.refVideos,
        models: { understand: model, write: model },
        onUsage: (step, m, tin, tout) => run.usage.push({ step, model: m, tin, tout }),
      });
      run.status = "done";
    } catch (e) {
      run.status = "error";
      run.error = e instanceof Error ? e.message : String(e);
    }
    run.seconds = Math.round((Date.now() - t0) / 1000);
    write(videoId, c);
  }
}
