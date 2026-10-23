import fs from "fs";
import path from "path";
import type { DB } from "./types";
import { monthlyLimit } from "./plans";

// Base de datos simple en un archivo JSON (data/db.json).
// Suficiente para la primera versión; después se cambia por Supabase/Postgres.

// En el servidor, DATA_DIR apunta al disco persistente (por ejemplo /data). En tu Mac es la carpeta data/.
export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function empty(): DB {
  return { users: [], projects: [], videos: [], imageLog: [], edits: [], pagos: [] };
}

function load(): DB {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

function save(db: DB) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
  backupDaily();
}

// Una copia de db.json por día en data/backups, guardando solo las últimas 14.
let lastBackup = "";
function backupDaily() {
  const day = new Date().toISOString().slice(0, 10);
  if (day === lastBackup) return;
  lastBackup = day;
  try {
    const dir = path.join(DATA_DIR, "backups");
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, `db-${day}.json`);
    if (!fs.existsSync(target)) fs.copyFileSync(DB_FILE, target);
    const old = fs.readdirSync(dir).filter((f) => f.startsWith("db-")).sort().slice(0, -14);
    for (const f of old) fs.unlinkSync(path.join(dir, f));
  } catch {}
}

export function read<T>(fn: (db: DB) => T): T {
  return fn(load());
}

// Lectura + escritura síncrona: no se pisan escrituras en paralelo.
export function mutate<T>(fn: (db: DB) => T): T {
  const db = load();
  const result = fn(db);
  save(db);
  return result;
}

export function newId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export function getProject(id: string) {
  return read((db) => db.projects.find((p) => p.id === id));
}

export function getEdit(id: string) {
  return read((db) => db.edits.find((e) => e.id === id));
}

export function getVideo(id: string) {
  return read((db) => db.videos.find((v) => v.id === id));
}

export function imagesThisMonth(userId?: string, admin = false) {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return read((db) =>
    db.imageLog.filter((l) => l.at.startsWith(prefix) && (!userId || l.userId === userId || (admin && !l.userId))).length
  );
}

// units = créditos gastados (calidad baja = 1, media = 3)
export function logImage(units = 1, userId?: string) {
  mutate((db) => {
    const at = new Date().toISOString();
    const u = userId ? db.users.find((x) => x.id === userId) : undefined;
    const prefix = at.slice(0, 7);
    const before = userId ? db.imageLog.filter((l) => l.at.startsWith(prefix) && l.userId === userId).length : 0;
    for (let i = 0; i < units; i++) db.imageLog.push({ at, userId });
    // Lo que pasa del cupo mensual se descuenta de las imágenes sueltas (packs y prueba)
    if (u && u.role !== "admin" && (u.credits ?? 0) > 0) {
      const lim = monthlyLimit(u);
      const over = Math.max(0, before + units - lim) - Math.max(0, before - lim);
      if (over > 0) u.credits = Math.max(0, (u.credits ?? 0) - over);
    }
  });
}
