import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { login } from "../actions";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function Login() {
  if (await currentUser()) redirect("/");
  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 26 }}>Entrar a Adscaler</h1>
        <span className="muted small">Ingresa con tu correo y contraseña.</span>
      </div>
      <AuthForm action={login} mode="login" />
      <span className="small muted">¿No tienes cuenta? <Link href="/registro">Crear cuenta</Link></span>
    </>
  );
}
