import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { currentUser, quota } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import { hasGemini } from "@/lib/gemini";
import { hasOpenAI } from "@/lib/images";
import { hasCharacter, isAnimated, type BrollMode, type VideoStatus, type VideoType } from "@/lib/types";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  if (!me) redirect("/login");
  const { used, limit } = quota(me);
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleDateString("es-CL", { month: "short" }).replace(".", "")}`;
  const renews = fmt(me.planUntil && me.role !== "admin" ? new Date(me.planUntil) : nextMonth);
  const planActive = !me.planUntil || new Date(me.planUntil) > new Date();
  const demo = !hasGemini() || !hasOpenAI();
  return (
    <div className="shell">
      <nav className="side" aria-label="Menú principal">
        <Link href="/" className="logo" aria-label="Adscaler, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/adscaler-oscuro.svg" alt="Adscaler" height={40} style={{ height: 40, width: "auto", display: "block" }} />
        </Link>
        <NavLinks admin={me.role === "admin"} />
        <div className="meter">
          <span>Imágenes este mes</span>
          <strong>
            {used} <span style={{ fontSize: 14, fontWeight: 500, color: "#AEB9CF" }}>de {limit}</span>
          </strong>
          <div className="bar"><span style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} /></div>
          <span>{planActive ? `Plan ${me.plan} · ${me.planUntil && me.role !== "admin" ? "vence" : "se renueva"} el ${renews}` : "Tu plan venció · elige uno en Plan y créditos"}</span>
          {demo && (
            <span>
              Modo demo: {!hasGemini() && "falta GEMINI_API_KEY"}
              {!hasGemini() && !hasOpenAI() && " y "}
              {!hasOpenAI() && "falta OPENAI_API_KEY"}
            </span>
          )}
        </div>
        <form action={logout} style={{ marginTop: 12 }}>
          <span style={{ display: "block", fontSize: 13, color: "#AEB9CF", overflow: "hidden", textOverflow: "ellipsis" }}>{me.email}</span>
          <button type="submit" className="btn ghost" style={{ padding: "6px 0", color: "#fff" }}>Cerrar sesión</button>
        </form>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}

const ORDER: VideoStatus[] = ["draft", "analyzed", "persona_approved", "done"];

export function Stepper({ status, type, mode }: { status: VideoStatus; type: VideoType; mode?: BrollMode }) {
  const steps: { label: string; at: VideoStatus }[] = [
    { label: "Brief", at: "draft" },
    ...(hasCharacter(type, mode) ? [{ label: isAnimated(type, mode) ? "Personaje animado" : "Personaje", at: "analyzed" as VideoStatus }] : []),
    { label: "Primera toma", at: "persona_approved" },
    { label: "Entrega para Flow", at: "done" },
  ];
  const cur = ORDER.indexOf(status);
  return (
    <ol className="steps" aria-label="Pasos">
      {steps.map((s, i) => {
        const idx = ORDER.indexOf(s.at);
        const state = idx === cur ? "on" : idx < cur ? "ok" : "";
        return (
          <li key={s.label} className={state} aria-current={state === "on" ? "step" : undefined}>
            {state === "ok" ? "✓" : i + 1} · {s.label}
          </li>
        );
      })}
    </ol>
  );
}

export function StatusPill({ status }: { status: VideoStatus }) {
  const map: Record<VideoStatus, [string, string]> = {
    draft: ["Brief sin analizar", "dim"],
    analyzed: ["Aprobando personaje", ""],
    persona_approved: ["Aprobando primera toma", ""],
    done: ["Listo para Flow", "solid"],
  };
  const [label, cls] = map[status];
  return <span className={`pill ${cls}`}>{label}</span>;
}
