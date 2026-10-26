import crypto from "crypto";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DATA_DIR, mutate, newId, read, imagesThisMonth } from "./db";
import type { User } from "./types";
import { monthlyLimit } from "./plans";

export const COOKIE = "adscaler_session";
const DAYS = 30;

/* ---------- clave para firmar la cookie ---------- */
function secret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(DATA_DIR, ".session-secret");
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    const s = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(f, s, { mode: 0o600 });
    return s;
  }
}
const sign = (v: string) => crypto.createHmac("sha256", secret()).update(v).digest("hex");

export function makeToken(userId: string) {
  const exp = Date.now() + DAYS * 86400000;
  const body = `${userId}.${exp}`;
  return `${body}.${sign(body)}`;
}

/** Devuelve el id de usuario si la cookie es válida y no venció. */
export function readToken(token?: string | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const good = sign(`${id}.${exp}`);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  if (Number(exp) < Date.now()) return null;
  return id;
}

/* ---------- contraseñas ---------- */
export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}
export function checkPassword(password: string, u: Pick<User, "salt" | "passHash">) {
  const a = Buffer.from(hashPassword(password, u.salt).hash, "hex");
  const b = Buffer.from(u.passHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- sesión ---------- */
export async function currentUser(): Promise<User | null> {
  const c = await cookies();
  const id = readToken(c.get(COOKIE)?.value);
  if (!id) return null;
  const u = read((db) => db.users.find((x) => x.id === id));
  return u && !u.disabled ? u : null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  return u;
}

export async function startSession(userId: string) {
  const c = await cookies();
  c.set(COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAYS * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/* ---------- freno a intentos de contraseña ---------- */
const attempts = new Map<string, { n: number; first: number }>();
export function tooManyAttempts(key: string) {
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > 10 * 60000) return false;
  return a.n >= 8;
}
export function noteAttempt(key: string, ok: boolean) {
  if (ok) return void attempts.delete(key);
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > 10 * 60000) attempts.set(key, { n: 1, first: Date.now() });
  else a.n++;
}

/* ---------- altas ---------- */
export const normEmail = (e: string) => e.trim().toLowerCase();

export function createUser(email: string, name: string, password: string): User {
  return mutate((db) => {
    const first = db.users.length === 0;
    const { salt, hash } = hashPassword(password);
    const u: User = {
      id: newId(),
      email: normEmail(email),
      name: name.trim() || email.split("@")[0],
      passHash: hash,
      salt,
      role: first ? "admin" : "user",
      plan: first ? "Admin" : "Prueba",
      imageLimit: first ? Number(process.env.MONTHLY_IMAGE_LIMIT || 270) : Number(process.env.FREE_IMAGE_LIMIT || 0),
      createdAt: new Date().toISOString(),
    };
    db.users.push(u);
    if (first) adoptOrphans(db, u.id); // los datos que ya existían pasan a ser de la primera cuenta (admin)
    return u;
  });
}

function adoptOrphans(db: import("./types").DB, userId: string) {
  for (const p of db.projects) if (!p.ownerId) p.ownerId = userId;
  for (const e of db.edits) if (!e.ownerId) e.ownerId = userId;
}

/* ---------- dueños: cada cuenta solo ve lo suyo ---------- */
const NOT_FOUND = "No encontrado";

export function ownProject(u: User, id: string) {
  const p = read((db) => db.projects.find((x) => x.id === id));
  if (!p || p.ownerId !== u.id) throw new Error(NOT_FOUND);
  return p;
}
export function ownVideo(u: User, id: string) {
  const v = read((db) => db.videos.find((x) => x.id === id));
  if (!v) throw new Error(NOT_FOUND);
  ownProject(u, v.projectId);
  return v;
}
export function ownEdit(u: User, id: string) {
  const e = read((db) => db.edits.find((x) => x.id === id));
  if (!e || e.ownerId !== u.id) throw new Error(NOT_FOUND);
  return e;
}

/* ---------- cupo de imágenes ---------- */
export function quota(u: User) {
  const used = imagesThisMonth(u.id, u.role === "admin");
  const monthly = monthlyLimit(u);
  const left = Math.max(0, monthly - used) + (u.role === "admin" ? 0 : u.credits ?? 0);
  return { used, limit: used + left, left };
}
/** Crear videos: solo cuentas que compraron algo y aún tienen imágenes (o el administrador). */
export function canCreateVideos(u: User) {
  return u.role === "admin" || quota(u).left > 0;
}
/** Editor: solo quien ya tiene al menos un video creado en la app con sus tomas para Flow (o el administrador). */
export function canUseEditor(u: User) {
  if (u.role === "admin") return true;
  return read((db) => {
    const ids = new Set(db.projects.filter((p) => p.ownerId === u.id).map((p) => p.id));
    return db.videos.some((v) => ids.has(v.projectId) && !!v.analysis?.shots?.length);
  });
}
export function assertQuota(userId: string | undefined, units: number) {
  if (!userId) return;
  const u = read((db) => db.users.find((x) => x.id === userId));
  if (!u) throw new Error("Cuenta no encontrada.");
  const q = quota(u);
  if (q.left < units) throw new Error(`Se acabaron tus imágenes (${q.used} usadas). Elige un plan o un pack en "Plan y créditos".`);
}

/** Para las rutas /api: devuelve una respuesta de error si no hay sesión o el montaje no es de esta cuenta. */
export async function guardEdit(id: string): Promise<Response | null> {
  const me = await currentUser();
  if (!me) return Response.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try {
    ownEdit(me, id);
  } catch {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  return null;
}
export async function guardVideo(id: string): Promise<Response | null> {
  const me = await currentUser();
  if (!me) return new Response("Inicia sesión para continuar.", { status: 401 });
  try {
    ownVideo(me, id);
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
  return null;
}
