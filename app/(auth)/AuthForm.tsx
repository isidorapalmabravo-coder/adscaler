"use client";
import { useActionState, useState } from "react";
import type { AuthState } from "./actions";

function Eye({ off }: { off: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

export function AuthForm({
  action,
  mode,
  needInvite,
}: {
  action: (prev: AuthState, form: FormData) => Promise<AuthState>;
  mode: "login" | "registro";
  needInvite?: boolean;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const [show, setShow] = useState(false);
  return (
    <form action={run} className="auth-form">
      {mode === "registro" && (
        <label className="field">
          Tu nombre
          <input type="text" name="name" autoComplete="name" placeholder="Ej.: Camila Rojas" required />
        </label>
      )}
      <label className="field">
        Correo
        <input type="email" name="email" autoComplete="email" placeholder="tu@correo.com" required />
      </label>
      <label className="field">
        <span>Contraseña {mode === "registro" && <span className="muted small" style={{ fontWeight: 400 }}>(mínimo 8 caracteres)</span>}</span>
        <span className="auth-pass">
          <input type={show ? "text" : "password"} name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "registro" ? 8 : undefined} placeholder={mode === "login" ? "Tu contraseña" : "Crea una contraseña"} required />
          <button type="button" className="auth-eye" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={show} title={show ? "Ocultar contraseña" : "Mostrar contraseña"}>
            <Eye off={show} />
          </button>
        </span>
      </label>
      {mode === "registro" && needInvite && (
        <label className="field">
          Código de invitación
          <input type="text" name="invite" autoComplete="off" placeholder="Te lo entregó quien te invitó" required />
        </label>
      )}
      {state?.error && <div className="auth-error" role="alert">{state.error}</div>}
      <button type="submit" className="btn auth-submit" disabled={pending}>
        {pending ? "Un momento…" : mode === "login" ? "Entrar" : "Crear mi cuenta"}
      </button>
      {mode === "registro" && (
        <p className="muted small" style={{ textAlign: "center", margin: 0 }}>
          Al crear tu cuenta aceptas los <a href="/terminos" target="_blank" rel="noreferrer">Términos y condiciones</a> y la <a href="/privacidad" target="_blank" rel="noreferrer">Política de privacidad</a>.
        </p>
      )}
    </form>
  );
}
