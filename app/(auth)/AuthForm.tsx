"use client";
import { useActionState } from "react";
import type { AuthState } from "./actions";

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
  return (
    <form action={run} className="stack" style={{ gap: 14 }}>
      {mode === "registro" && (
        <label className="field">
          Tu nombre
          <input type="text" name="name" autoComplete="name" required />
        </label>
      )}
      <label className="field">
        Correo
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label className="field">
        Contraseña {mode === "registro" && <span className="muted small">(mínimo 8 caracteres)</span>}
        <input type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "registro" ? 8 : undefined} required />
      </label>
      {mode === "registro" && needInvite && (
        <label className="field">
          Código de invitación
          <input type="text" name="invite" autoComplete="off" required />
        </label>
      )}
      {state?.error && <span className="error" role="alert">{state.error}</span>}
      <button type="submit" className="btn big" disabled={pending}>
        {pending ? "Un momento…" : mode === "login" ? "Entrar" : "Crear mi cuenta"}
      </button>
    </form>
  );
}
