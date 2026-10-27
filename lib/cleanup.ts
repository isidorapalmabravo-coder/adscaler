import fs from "fs";
import path from "path";
import { DATA_DIR, mutate } from "./db";
import { UPLOAD_DIR } from "./files";

const MB = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

function dirSize(p: string): number {
  let t = 0;
  try {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const f = path.join(p, e.name);
      t += e.isDirectory() ? dirSize(f) : fs.statSync(f).size;
    }
  } catch {}
  return t;
}

const FILE_RE = /[a-z0-9]{6,}\.(?:png|jpe?g|webp|svg|mp4|wav|mp3|mov|webm|docx|txt|md)/gi;
const namesIn = (txt: string) => (txt.match(FILE_RE) ?? []).map((x) => x.toLowerCase());

/** Todos los archivos que algo usa: la base de datos (db.json) y los datos de comparar (compare-*.json). */
function usedNames(): Set<string> | null {
  const used = new Set<string>();
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, "db.json"), "utf8");
    if (raw.length < 100) return null; // base vacía o dañada: no se borra nada
    namesIn(raw).forEach((n) => used.add(n));
    for (const e of fs.readdirSync(DATA_DIR, { withFileTypes: true })) {
      if (e.isFile() && /^compare-.*\.json$/.test(e.name)) namesIn(fs.readFileSync(path.join(DATA_DIR, e.name), "utf8")).forEach((n) => used.add(n));
    }
    return used;
  } catch {
    return null;
  }
}

/** Al eliminar un proyecto: borra del disco sus archivos, si nada más los usa. */
export function deleteUnusedFilesOf(removedJson: string) {
  try {
    const used = usedNames();
    if (!used) return;
    for (const n of new Set(namesIn(removedJson))) {
      if (used.has(n)) continue;
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, n));
      } catch {}
    }
  } catch {}
}

/** A los 30 días se borran las imágenes y los videos de referencia de cada video; los prompts y guiones se conservan. */
export function purgeOldVideos() {
  try {
    const limit = Date.now() - 30 * 86400000;
    const files: string[] = [];
    mutate((db) => {
      for (const v of db.videos) {
        if (v.purgedAt || new Date(v.createdAt).getTime() >= limit) continue;
        v.analysis?.shots.forEach((s) => {
          if (s.image) files.push(s.image);
          s.image = undefined;
        });
        v.personaImages.filter((f) => f !== v.personaChosen).forEach((f) => files.push(f));
        v.personaImages = v.personaImages.filter((f) => f === v.personaChosen);
        v.refVideos.forEach((f) => files.push(f));
        v.refVideos = [];
        v.purgedAt = new Date().toISOString();
      }
    });
    if (files.length) deleteUnusedFilesOf(JSON.stringify(files));
  } catch {}
}

/**
 * Libera espacio del disco: borra las carpetas temporales abandonadas (tmp-*) y los archivos subidos o
 * generados que nada usa (ni db.json ni los datos de comparar) y que tienen más de 24 horas.
 */
export function cleanupDisk() {
  purgeOldVideos();
  try {
    if (!fs.existsSync(UPLOAD_DIR)) return;
    const now = Date.now();
    let freed = 0;
    let removed = 0;
    for (const e of fs.readdirSync(UPLOAD_DIR, { withFileTypes: true })) {
      if (e.isDirectory() && /^tmp-/.test(e.name)) {
        const f = path.join(UPLOAD_DIR, e.name);
        try {
          if (now - fs.statSync(f).mtimeMs < 10 * 60 * 1000) continue;
          const sz = dirSize(f);
          fs.rmSync(f, { recursive: true, force: true });
          freed += sz;
          removed++;
        } catch {}
      }
    }
    const used = usedNames();
    if (used) {
      for (const e of fs.readdirSync(UPLOAD_DIR, { withFileTypes: true })) {
        if (!e.isFile() || used.has(e.name.toLowerCase())) continue;
        const f = path.join(UPLOAD_DIR, e.name);
        try {
          const st = fs.statSync(f);
          if (now - st.mtimeMs < 24 * 3600 * 1000) continue;
          fs.unlinkSync(f);
          freed += st.size;
          removed++;
        } catch {}
      }
    }
    console.log(`[limpieza] borrados ${removed} (${MB(freed)}). Uso ahora: uploads ${MB(dirSize(UPLOAD_DIR))}, total ${MB(dirSize(DATA_DIR))}`);
  } catch (e) {
    console.log("[limpieza] error", e instanceof Error ? e.message : e);
  }
}
