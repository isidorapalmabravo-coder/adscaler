"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pending,
  className = "btn",
  disabled = false,
}: {
  children: React.ReactNode;
  pending?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending: isPending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={isPending || disabled} aria-busy={isPending}>
      {isPending ? pending ?? "Trabajando…" : children}
    </button>
  );
}

export function CopyButton({ text, label = "Copiar", className = "btn outline" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* el navegador no permitió copiar */
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? "Copiado ✓" : label}
    </button>
  );
}

/** Eliminar con doble confirmación: el primer clic solo pregunta, el segundo elimina. */
export function ConfirmDeleteForm({
  action,
  label = "Eliminar",
  message = "¿Estás seguro de que quieres eliminar esto? No se puede deshacer.",
  className = "btn ghost small",
  icon = false,
}: {
  action: () => void | Promise<void>;
  label?: string;
  message?: string;
  className?: string;
  icon?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return icon ? (
      <button type="button" className="icon-btn" onClick={() => setAsking(true)} aria-label={label} title={label}>
        <TrashIcon />
      </button>
    ) : (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <form action={action} className={icon ? "confirm-box compact" : "confirm-box"} role="alertdialog" aria-label="Confirmar eliminación">
      <strong>{message}</strong>
      <div className="row" style={{ gap: 10 }}>
        <ConfirmSubmit />
        <button type="button" className="btn outline small" onClick={() => setAsking(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function ConfirmSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn danger small" disabled={pending}>
      {pending ? "Eliminando…" : "Sí, eliminar"}
    </button>
  );
}

/** Barra de progreso con tiempo. Va DENTRO de un <form>: aparece al enviarlo y se bloquea el botón para no enviar dos veces.
 *  Es una estimación por tiempo (la IA no informa su avance): sube rápido al inicio y se frena cerca del 95 %. */
export function TimedProgress({
  expectedSeconds = 150,
  stages = ["Trabajando"],
  hint = "No cierres esta página ni vuelvas a apretar el botón.",
}: {
  expectedSeconds?: number;
  stages?: string[];
  hint?: string;
}) {
  const { pending: formPending } = useFormStatus();
  const ref = useRef<HTMLDivElement>(null);
  const wasPending = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [t, setT] = useState(0);

  const setButtons = (disabled: boolean) => {
    ref.current?.closest("form")?.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      if (!b.hasAttribute("data-keep")) b.disabled = disabled;
    });
  };

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onSubmit = () => {
      setSubmitted(true);
      setTimeout(() => setButtons(true), 0);
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando la acción termina y la página sigue abierta (por ejemplo, una imagen), se vuelve a la normalidad
  useEffect(() => {
    if (formPending) wasPending.current = true;
    else if (wasPending.current) {
      wasPending.current = false;
      setSubmitted(false);
      setButtons(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formPending]);

  const active = formPending || submitted;
  useEffect(() => {
    if (!active) {
      setT(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setT((Date.now() - start) / 1000), 500);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return <div ref={ref} />;
  const pct = Math.min(95, Math.round(95 * (1 - Math.exp(-t / (expectedSeconds * 0.55)))));
  const stage = stages[Math.min(stages.length - 1, Math.floor((pct / 100) * stages.length))];
  const mmss = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const est = expectedSeconds >= 90 ? `~${Math.round(expectedSeconds / 60)} min` : `~${Math.round(expectedSeconds)} s`;
  return (
    <div ref={ref} className="progress-box" role="status" aria-live="polite">
      <div className="row between">
        <strong>{stage}…</strong>
        <strong>{pct}%</strong>
      </div>
      <div className="progress" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="row between small muted">
        <span>Llevas {mmss} · estimado {est}</span>
        <span>{hint}</span>
      </div>
    </div>
  );
}

/** Progreso de "Analizar brief". */
export function AnalysisProgress() {
  return (
    <TimedProgress
      expectedSeconds={150}
      stages={["Leyendo el brief y las fotos del producto", "Escribiendo los prompts de cada toma", "Últimos ajustes"]}
    />
  );
}

/** Panel de "analizando el brief". Corre en segundo plano en el servidor; la barra sale de la hora real de inicio,
 *  así que se ve igual aunque la persona vuelva atrás o recargue. La página se refresca sola hasta que termina. */
export function AnalyzingPanel({
  startedAt,
  expectedSeconds = 90,
  stages = ["Leyendo el brief y las fotos del producto", "Escribiendo los prompts de cada toma", "Últimos ajustes"],
  retry,
}: {
  startedAt: string;
  expectedSeconds?: number;
  stages?: string[];
  retry?: React.ReactNode;
}) {
  const router = useRouter();
  const [t, setT] = useState(() => Math.max(0, (Date.now() - Date.parse(startedAt)) / 1000));

  useEffect(() => {
    const tick = setInterval(() => setT(Math.max(0, (Date.now() - Date.parse(startedAt)) / 1000)), 500);
    const poll = setInterval(() => router.refresh(), 3000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [startedAt, router]);

  const pct = Math.min(95, Math.round(95 * (1 - Math.exp(-t / (expectedSeconds * 0.55)))));
  const stage = stages[Math.min(stages.length - 1, Math.floor((pct / 100) * stages.length))];
  const mmss = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const slow = t > expectedSeconds * 2;
  return (
    <div className="progress-box" role="status" aria-live="polite" style={{ padding: 24 }}>
      <h2 style={{ margin: "0 0 4px" }}>Analizando tu brief</h2>
      <p className="muted small" style={{ margin: "0 0 14px" }}>
        La IA está leyendo el brief y escribiendo los prompts. Puedes quedarte aquí o volver más tarde: el trabajo sigue aunque salgas de esta página.
      </p>
      <div className="row between">
        <strong>{stage}…</strong>
        <strong>{pct}%</strong>
      </div>
      <div className="progress" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="row between small muted">
        <span>Llevas {mmss} · normalmente tarda 2 a 4 min</span>
        <span>Esta página se actualiza sola</span>
      </div>
      {slow && (
        <div className="small" style={{ marginTop: 14 }}>
          <p className="muted" style={{ margin: "0 0 8px" }}>Está tardando más de lo normal. Si pasan unos minutos más y no avanza, puedes reintentar.</p>
          {retry}
        </div>
      )}
    </div>
  );
}

/** Nombre editable: se ve normal y, con el lápiz, se puede cambiar. */
export function EditableTitle({
  value,
  onSave,
  href,
  style,
}: {
  value: string;
  onSave: (title: string) => Promise<void>;
  href?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const t = text.trim();
    if (!t || t === value) {
      setText(value);
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onSave(t);
      router.refresh();
    } finally {
      setBusy(false);
      setEditing(false);
    }
  };
  if (editing) {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <input
          autoFocus
          value={text}
          maxLength={120}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setText(value);
              setEditing(false);
            }
          }}
          aria-label="Nombre del video"
          style={{ padding: "6px 10px", borderRadius: 6, border: "2px solid var(--accent)", font: "inherit", fontWeight: 600, minWidth: 220 }}
        />
        <button type="button" className="btn" onClick={save} disabled={busy} style={{ padding: "6px 12px" }}>{busy ? "Guardando…" : "Guardar"}</button>
        <button type="button" className="btn outline" onClick={() => { setText(value); setEditing(false); }} style={{ padding: "6px 12px" }}>Cancelar</button>
      </span>
    );
  }
  const label = value || "Video sin título";
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      {href ? <Link href={href} style={{ fontWeight: 600, ...style }}>{label}</Link> : <strong style={style}>{label}</strong>}
      <button type="button" onClick={() => { setText(value); setEditing(true); }} title="Cambiar nombre" aria-label="Cambiar nombre" style={{ background: "none", border: 0, cursor: "pointer", fontSize: 16, padding: 4 }}>✏️</button>
    </span>
  );
}
