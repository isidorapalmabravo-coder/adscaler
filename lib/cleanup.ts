import fs from "fs";
import path from "path";
import { DATA_DIR } from "./db";
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

/**
 * Libera espacio del disco borrando SOLO las carpetas temporales abandonadas (tmp-*) que dejan los
 * renders del editor que fallaron. Los archivos de los usuarios no se tocan: solo se cuenta cuántos
 * parecen no usarse, para decidir con datos si vale la pena limpiarlos.
 */
export function cleanupDisk() {
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

    // Solo informa: cuánto ocupan los archivos que ninguna parte de db.json menciona
    let unusedBytes = 0;
    let unusedCount = 0;
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, "db.json"), "utf8");
      if (raw.length > 100) {
        const used = new Set((raw.match(/[a-z0-9]{6,}\.(?:png|jpe?g|webp|svg|mp4|wav|mp3|mov|webm|docx|txt|md)/gi) ?? []).map((s) => s.toLowerCase()));
        for (const e of fs.readdirSync(UPLOAD_DIR, { withFileTypes: true })) {
          if (e.isFile() && !used.has(e.name.toLowerCase())) {
            unusedBytes += fs.statSync(path.join(UPLOAD_DIR, e.name)).size;
            unusedCount++;
          }
        }
      }
    } catch {}

    console.log(
      `[limpieza] carpetas tmp borradas: ${removed} (${MB(freed)}). Archivos sin uso aparente: ${unusedCount} (${MB(unusedBytes)}). Uso ahora: uploads ${MB(dirSize(UPLOAD_DIR))}, total ${MB(dirSize(DATA_DIR))}`
    );
  } catch (e) {
    console.log("[limpieza] error", e instanceof Error ? e.message : e);
  }
}
