"use client";

import { useState } from "react";
import { PLANES, PACKS, PRUEBA, CODES, PROMO_PERCENT, IMAGENES_POR_VIDEO, findCode, codeExpired, priceWithCode, promoPrice, clp } from "@/lib/plans";

export function PlansClient() {
  const [input, setInput] = useState("");
  const [applied, setApplied] = useState<string>("");
  const [error, setError] = useState("");
  const code = applied ? findCode(applied) : null;

  function apply() {
    const c = findCode(input);
    if (!input.trim()) return;
    if (!c) {
      setApplied("");
      setError("Ese código no existe.");
      return;
    }
    if (codeExpired(c)) {
      setApplied("");
      setError("Este código ya venció.");
      return;
    }
    setError("");
    setApplied(c.code);
  }

  return (
    <div className="stack-lg">
      {(
      <div className="card stack" style={{ gap: 10 }}>
        <label className="field" style={{ margin: 0 }}>
          ¿Tienes un código de descuento?
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} placeholder="Escribe tu código" style={{ maxWidth: 260 }} autoCapitalize="characters" />
            <button type="button" className="btn outline" onClick={apply}>Aplicar</button>
          </div>
        </label>
        {error && <span className="error" role="alert">{error}</span>}
        {code && <span className="small" style={{ color: "#1F5E3E" }}>Código {code.code} aplicado: {code.nota}. Solo vale para suscripciones mensuales, no para packs de videos.</span>}
      </div>
      )}

      <section className="plan main" style={{ gap: 10 }}>
        <div className="stack" style={{ gap: 6 }}>
          <h2>
            Pruébalo con 1 video
            <span className="pill solid">Para empezar</span>
          </h2>
          <span className="muted small">Crea un video completo con tu producto y comprueba que funciona antes de suscribirte.</span>
        </div>
        <div className="row" style={{ alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span className="price">{clp(PRUEBA.precio)}</span>
          <span className="muted small">pago único · IVA incluido</span>
        </div>
        <span className="small muted">Incluye persona, tomas, prompts para Flow, voz en off y subtítulos: unas {IMAGENES_POR_VIDEO} imágenes.</span>
        <a href="#" className="btn">Probar por {clp(PRUEBA.precio)}</a>
      </section>

      <div className="stack" style={{ gap: 6 }}>
        <h2>Suscripción mensual</h2>
        <span className="muted small">Cada mes recibes imágenes para crear tus videos. Los videos los animas tú, en tu propia cuenta de Flow.</span>
      </div>
      <div className="plans">
        {PLANES.map((p) => {
          const final = priceWithCode(p, code);
          const off = final < p.precio;
          const extra = final < promoPrice(p);
          return (
            <section key={p.id} className={`plan${p.destacado ? " main" : ""}`}>
              <div className="stack" style={{ gap: 6 }}>
                <h2>
                  {p.nombre}
                  {p.destacado && <span className="pill solid">Para producir seguido</span>}
                </h2>
                <span className="muted small">{p.para}</span>
              </div>
              <div className="row" style={{ alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                {off && <span className="muted" style={{ textDecoration: "line-through", fontSize: 18 }}>{clp(p.precio)}</span>}
                <span className="price">{clp(final)}</span>
                <span className="muted small">al mes · IVA incluido</span>
              </div>
              {off && <span className="pill solid" style={{ justifySelf: "start" }}>Ahorras {clp(p.precio - final)} al mes (con tu código)</span>}
              <span className="small"><strong>{clp(final / p.videos)} por video</strong> <span className="muted">si usas los {p.videos} del mes</span></span>
              <div className="quota">
                <strong>{p.imagenes.toLocaleString("es-CL")} imágenes</strong>
                <span className="muted small">al mes · alcanza para {p.videos} videos de 12 a 15 tomas</span>
              </div>
              <ul>
                <li>Personaje y producto iguales en todas las tomas</li>
                <li>Prompts de animación listos para Flow</li>
                <li>Editor de video con voz en off y subtítulos</li>
              </ul>
              <a href="#" className={`btn${p.destacado ? "" : " outline"}`}>Elegir {p.nombre}</a>
            </section>
          );
        })}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <h2>O compra solo los videos que necesitas</h2>
        <span className="muted small">Pago único, sin suscripción. Los códigos de descuento no aplican a los packs.</span>
      </div>
      <div className="plans">
        {PACKS.map((k) => (
          <section key={k.id} className="plan">
            <h2>{k.videos} videos</h2>
            <div className="row" style={{ alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span className="price">{clp(k.precio)}</span>
              <span className="muted small">pago único · IVA incluido</span>
            </div>
            <div className="quota">
              <strong>{clp(k.precio / k.videos)} por video</strong>
              <span className="muted small">unas {(k.videos * IMAGENES_POR_VIDEO).toLocaleString("es-CL")} imágenes en total</span>
            </div>
            <a href="#" className="btn outline">Comprar {k.videos} videos</a>
          </section>
        ))}
      </div>
    </div>
  );
}
