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
  const needInvite = !first && !!process.env.INVITE_CODE;
  return (
    <>
      <div className="stack" style={{ gap: 6 }}>
        <h1 style={{ fontSize: 28 }}>{first ? "Crea la cuenta principal" : "Crear cuenta"}</h1>
        <span className="muted small">
          {first ? "Esta primera cuenta es la administradora y se queda con todo lo que ya creaste." : "Es gratis para empezar, con unas pocas imágenes de prueba."}
        </span>
      </div>
      <AuthForm action={register} mode="registro" needInvite={needInvite} />
      <span className="auth-foot">¿Ya tienes cuenta? <Link href="/login">Entrar</Link></span>
    </>
  );
}
