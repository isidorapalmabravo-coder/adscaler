import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { register } from "../actions";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function Registro() {
  if (await currentUser()) redirect("/");
  const first = read((db) => db.users.length === 0);
  return (
    <>
      <div className="stack" style={{ gap: 6 }}>
        <h1 style={{ fontSize: 28 }}>{first ? "Crea la cuenta principal" : "Crear cuenta"}</h1>
        <span className="muted small">
          {first ? "Esta primera cuenta es la administradora de Adscaler." : "Crea tu cuenta y prueba Adscaler con un video de prueba."}
        </span>
      </div>
      <AuthForm action={register} mode="registro" />
      <span className="auth-foot">¿Ya tienes cuenta? <Link href="/login">Entrar</Link></span>
    </>
  );
}
