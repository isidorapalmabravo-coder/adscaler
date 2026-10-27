import fs from "fs";
import path from "path";
import { DATA_DIR, newId } from "./db";

export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

export const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

const SAFE_NAME = /^[a-z0-9]+\.[a-z0-9]+$/;

export function isSafeName(name: string) {
  return SAFE_NAME.test(name);
}

export function filePath(name: string) {
  if (!isSafeName(name)) throw new Error("Nombre de archivo no válido");
  return path.join(UPLOAD_DIR, name);
}

export function mimeOf(name: string) {
  return MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream";
}

export const DISK_FULL_MSG =
  "Estamos con mucha gente y el almacenamiento está al límite en este momento. Ya estamos liberando espacio: intenta de nuevo en unos minutos.";

export function friendlyDiskError(msg: string) {
  return /ENOSPC|no space left/i.test(msg) ? DISK_FULL_MSG : msg;
}

export function saveBuffer(buf: Buffer, ext: string) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const name = `${newId()}.${clean}`;
  try {
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  } catch (e) {
    throw new Error(friendlyDiskError(e instanceof Error ? e.message : String(e)));
  }
  return name;
}

export async function saveUpload(file: File) {
  const ext = path.extname(file.name) || ".bin";
  const buf = Buffer.from(await file.arrayBuffer());
  return saveBuffer(buf, ext);
}

// Devuelve solo los archivos reales que vienen en un input file (múltiple)
export function filesFrom(form: FormData, key: string): File[] {
  return form
    .getAll(key)
    .filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0);
}

export function fileUrl(name: string) {
  return `/api/files/${name}`;
}
