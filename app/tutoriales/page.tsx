import { AppShell } from "@/components/ui";

const TUTORIALES = [
  { t: "Tutorial 1 · 4 min", d: "Un video completo, del brief a Flow." },
  { t: "Tutorial 2 · UGC", d: "Cómo funciona un video con una persona hablando a cámara." },
  { t: "Tutorial 3 · B-roll", d: "Planos de producto con voz en off. Próximamente." },
];

export default function Tutoriales() {
  return (
    <AppShell>
      <div className="stack">
        <span className="muted small">Aprende a usarlo</span>
        <h1>Tutoriales</h1>
      </div>
      <div className="grid">
        {TUTORIALES.map((x) => (
          <div key={x.t} className="card pcard">
            <div className="ph" style={{ height: 150, background: "var(--black)", color: "var(--soft)" }}>Video pendiente</div>
            <div className="stack" style={{ padding: 18, gap: 6 }}>
              <strong style={{ fontSize: 17 }}>{x.t}</strong>
              <span className="muted small">{x.d}</span>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
