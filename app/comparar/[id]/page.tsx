import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVideo } from "@/lib/db";
import { readCompare, costClp, PRO, LITE, FX, type Run, type Usage } from "@/lib/compare";
import { startCompare, compareImage } from "../actions";
import { fileUrl } from "@/lib/files";
import { SubmitButton } from "@/components/client";
import { Refresh } from "./Refresh";

export const dynamic = "force-dynamic";

const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const sum = (u: Usage[], step?: string) => u.filter((x) => !step || x.step === step).reduce((a, x) => a + costClp(x), 0);
const tok = (u: Usage[]) => u.reduce((a, x) => a + x.tin + x.tout, 0);

export default async function Comparar({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const video = getVideo(id);
  if (!video) notFound();
  const c = readCompare(id);
  const running = c?.runs.some((r) => r.status === "running" || r.status === "waiting") ?? false;
  const pro = c?.runs.find((r) => r.key === "pro");
  const lite = c?.runs.find((r) => r.key === "lite");
  const done = pro?.status === "done" && lite?.status === "done";

  const img = (n: number, run: Run | undefined) => {
    const f = run?.images?.[String(n)];
    // eslint-disable-next-line @next/next/no-img-element
    return f ? <img src={fileUrl(f)} alt={`Toma ${n} con ${run?.label}`} style={{ width: "100%", maxWidth: 260, borderRadius: 6, aspectRatio: "2 / 3", objectFit: "cover" }} /> : null;
  };
  const cell: React.CSSProperties = { padding: 8, verticalAlign: "top", borderTop: "1px solid var(--line)", fontSize: 13, lineHeight: 1.45 };

  return (
    <div>
      <header className="topbar">
        <Link href={`/videos/${id}`} style={{ textDecoration: "none", fontWeight: 500 }}>← {video.title}</Link>
      </header>
      {running && <Refresh />}
      <div className="wrap stack-lg" style={{ padding: "32px 24px 80px" }}>
        <div className="stack">
          <h1>Probar modelos de Gemini</h1>
          <p className="muted">
            Analiza <strong>este mismo video</strong> (brief, fotos y video de referencia) con dos modelos y te muestra lado a lado qué escribió cada uno y cuánto costó de verdad.
            Modelos: <code>{PRO}</code> y <code>{LITE}</code>. Tu video actual no se modifica.
          </p>
        </div>

        {!c && (
          <form action={startCompare.bind(null, id)} className="stack">
            <SubmitButton className="btn xl">Empezar la prueba</SubmitButton>
            <span className="muted small">Tarda unos minutos y gasta alrededor de {clp(550)} en Gemini (el análisis con Pro y el de Flash-Lite).</span>
          </form>
        )}

        {c && (
          <section className="card stack" style={{ padding: 20, gap: 12 }}>
            <h2>Costo real de esta prueba</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8 }}>Modelo</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Estado</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Paso 1 · entender</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Paso 2 · escribir</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Total</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Tomas</th>
                  <th style={{ textAlign: "right", padding: 8 }}>Tiempo</th>
                </tr>
              </thead>
              <tbody>
                {c.runs.map((r: Run) => (
                  <tr key={r.key}>
                    <td style={cell}><strong>{r.label}</strong></td>
                    <td style={cell}>{r.status === "done" ? "Listo" : r.status === "error" ? "Error" : r.status === "running" ? "Trabajando…" : "En espera"}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{clp(sum(r.usage, "entender"))}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{clp(sum(r.usage, "escribir"))}</td>
                    <td style={{ ...cell, textAlign: "right" }}><strong>{clp(sum(r.usage))}</strong> <span className="muted">({tok(r.usage).toLocaleString("es-CL")} tokens)</span></td>
                    <td style={{ ...cell, textAlign: "right" }}>{r.analysis?.shots.length ?? "—"}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{r.seconds ? `${r.seconds} s` : "—"}</td>
                  </tr>
                ))}
                {done && pro && lite && (
                  <tr>
                    <td style={cell}><strong>Mixto</strong> <span className="muted">(Pro entiende + Flash-Lite escribe, estimado)</span></td>
                    <td style={cell}>—</td>
                    <td style={{ ...cell, textAlign: "right" }}>{clp(sum(pro.usage, "entender"))}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{clp(sum(lite.usage, "escribir"))}</td>
                    <td style={{ ...cell, textAlign: "right" }}><strong>{clp(sum(pro.usage, "entender") + sum(lite.usage, "escribir"))}</strong></td>
                    <td style={cell} />
                    <td style={cell} />
                  </tr>
                )}
              </tbody>
            </table>
            <span className="muted small">Calculado con los tokens que Google informó en cada llamada, al precio de lista y a {FX} pesos por dólar. Incluye el pensamiento interno del modelo.</span>
            {c.runs.filter((r) => r.error).map((r) => (
              <p key={r.key} className="error" role="alert">{r.label}: {r.error}</p>
            ))}
          </section>
        )}

        {c && pro?.analysis && (
          <section className="stack" style={{ gap: 14 }}>
            <h2>Lo que entendió cada uno</h2>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
              {[pro, lite].map((r) => (
                <div key={r!.key} className="card stack" style={{ padding: 16, gap: 8 }}>
                  <strong>{r!.label}</strong>
                  {r!.analysis ? (
                    <>
                      <p className="small">{r!.analysis.summary}</p>
                      {r!.analysis.understanding && (
                        <ul className="small" style={{ paddingLeft: 18 }}>
                          <li><strong>Hook:</strong> {r!.analysis.understanding.hook}</li>
                          <li><strong>Tono:</strong> {r!.analysis.understanding.tone}</li>
                          <li><strong>Referencia:</strong> {r!.analysis.understanding.referenceStyle || "—"}</li>
                          <li><strong>Reglas:</strong> {r!.analysis.understanding.rules.length}</li>
                        </ul>
                      )}
                    </>
                  ) : (
                    <p className="muted small">{r!.status === "error" ? "No salió." : "Todavía no termina…"}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {done && pro?.analysis && lite?.analysis && (
          <section className="stack" style={{ gap: 10 }}>
            <h2>Toma por toma</h2>
            <p className="muted small">Fíjate en tres cosas: que la Flash-Lite no cambie las tomas ni el orden, que mantenga el texto hablado, y que cada prompt diga dos manos y dos brazos.</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40, padding: 8 }}>#</th>
                    <th style={{ textAlign: "left", padding: 8 }}>Pro</th>
                    <th style={{ textAlign: "left", padding: 8 }}>Flash-Lite</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.max(pro.analysis.shots.length, lite.analysis.shots.length) }).map((_, i) => {
                    const a = pro.analysis!.shots[i];
                    const b = lite.analysis!.shots[i];
                    const col = (s: typeof a | undefined, side: Run | undefined) =>
                      s ? (
                        <div className="stack" style={{ gap: 6 }}>
                          <span className="muted">{s.duration} · {s.kind}{s.showsProduct ? " · producto" : ""}</span>
                          <span><strong>Dice:</strong> {s.audio || "—"}</span>
                          <details><summary>Prompt de imagen</summary><p>{s.imagePrompt}</p></details>
                          <details><summary>Prompt de animación</summary><p>{s.animationPrompt}</p></details>
                          {img(s.n, side)}
                        </div>
                      ) : (
                        <span className="muted">(sin esta toma)</span>
                      );
                    const both = a && b && pro.images?.[String(a.n)] && lite.images?.[String(b.n)];
                    return (
                      <tr key={i}>
                        <td style={{ ...cell, textAlign: "center" }}>{i + 1}</td>
                        <td style={cell}>
                          {col(a, pro)}
                          {a && b && !both && (
                            <form action={compareImage.bind(null, id, a.n)} style={{ marginTop: 8 }}>
                              <SubmitButton className="btn outline">Generar las 2 imágenes de esta toma (~$60 CLP)</SubmitButton>
                            </form>
                          )}
                        </td>
                        <td style={cell}>{col(b, lite)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {c && !running && (
          <form action={startCompare.bind(null, id)}>
            <SubmitButton className="btn outline">Repetir la prueba</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
