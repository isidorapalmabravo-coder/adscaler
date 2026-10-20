import { AppShell } from "@/components/ui";
import { PlansClient } from "@/components/PlansClient";

export default function PlanesPage() {
  return (
    <AppShell>
      <div className="wrap stack-lg">
        <div className="stack">
          <span className="muted small">Tu suscripción</span>
          <h1>Planes y precios</h1>
          <p className="muted">Elige una suscripción mensual o compra solo los videos que necesitas.</p>
        </div>

        <PlansClient />

        <div className="card stack-lg">
          <div className="stack" style={{ gap: 6 }}>
            <h1 style={{ fontSize: 26 }}>¿Cuántas imágenes gasta un video?</h1>
            <p className="muted">Una imagen es un crédito. Un video de 12 a 15 tomas usa unas 22 a 28 imágenes.</p>
          </div>
          <div className="eq">
            <div className="cell"><strong>3</strong><span className="muted small">del personaje (2 opciones por tanda)</span></div>
            <span className="op">+</span>
            <div className="cell"><strong>12-15</strong><span className="muted small">tomas, una imagen cada una</span></div>
            <span className="op">+</span>
            <div className="cell"><strong>~7-10</strong><span className="muted small">repeticiones de tomas que no te convencen</span></div>
            <span className="op">=</span>
            <div className="cell res"><strong>~22-28</strong><span className="muted small">imágenes por video</span></div>
          </div>
          <div className="row small muted" style={{ gap: "8px 32px" }}>
            <span>La opción de mayor calidad gasta 3 imágenes en vez de 1.</span>
            <span>Analizar el brief y regenerar prompts de animación no gasta imágenes.</span>
          </div>
        </div>
        <p className="muted small">Los precios y las cantidades se confirman antes del lanzamiento.</p>
      </div>
    </AppShell>
  );
}
