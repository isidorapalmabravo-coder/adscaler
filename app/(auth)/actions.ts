"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { read, mutate } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createUser, checkPassword, endSession, startSession, normEmail, tooManyAttempts, noteAttempt, requireAdmin } from "@/lib/auth";

export type AuthState = { error?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function ip() {
  const h = await headers();
  return (h.get("x-forwarded-for") || "local").split(",")[0].trim();
}

export async function login(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = normEmail(str(form, "email"));
  const password = String(form.get("password") ?? "");
  const key = `${await ip()}|${email}`;
  if (tooManyAttempts(key)) return { error: "Demasiados intentos. Espera 10 minutos y vuelve a probar." };
  const u = read((db) => db.users.find((x) => x.email === email));
  if (!u || u.disabled || !checkPassword(password, u)) {
    noteAttempt(key, false);
    return { error: "Correo o contraseña incorrectos." };
  }
  noteAttempt(key, true);
  await startSession(u.id);
  redirect("/");
}

export async function register(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = normEmail(str(form, "email"));
  const name = str(form, "name");
  const password = String(form.get("password") ?? "");
  if (!EMAIL.test(email)) return { error: "Escribe un correo válido." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (read((db) => db.users.some((x) => x.email === email))) return { error: "Ya existe una cuenta con ese correo. Inicia sesión." };
  const u = createUser(email, name, password);
  await startSession(u.id);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

/** Solo admin: cambia el plan y el cupo de imágenes de una cuenta, o la desactiva. */
export async function updateUser(userId: string, form: FormData) {
  const me = await requireAdmin();
  const limit = Math.max(0, Math.round(Number(form.get("imageLimit")) || 0));
  const plan = str(form, "plan").slice(0, 30) || "Prueba";
  const disabled = form.get("disabled") === "on" && userId !== me.id;
  mutate((db) => {
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    u.imageLimit = limit;
    u.plan = plan;
    u.disabled = disabled || undefined;
  });
  revalidatePath("/admin");
}
