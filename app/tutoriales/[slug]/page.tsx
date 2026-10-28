import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/ui";
import { CopyButton } from "@/components/client";
import { DRIVE_DOCS, TUTORIALES, videoId } from "@/lib/tutoriales";

export const dynamic = "force-dynamic";

function metodo() {
  try {
    return fs.readFileSync(path.join(process.cwd(), "content", "metodo-anuncios.md"), "utf8");
  } catch {
    return "";
  }
}

export default async function Tutorial({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const x = TUTORIALES.find((t) => t.slug === slug);
  if (!x) notFound();
  const id = videoId(x.link);
  const md = x.method ? metodo() : "";

  return (
    <AppShell>
      <div className="stack" style={{ gap: 14, maxWidth: 900 }}>
        <Link href="/tutoriales" className="muted small">← Todos los tutoriales</Link>
        <h1>{x.t}</h1>

        {id ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title={x.t}
            allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            style={{ width: "100%", aspectRatio: "16 / 9", border: 0, background: "#000", borderRadius: 8 }}
          />
        ) : (
          <div className="ph" style={{ height: 300, background: "var(--black)", color: "var(--soft)" }}>Video próximamente</div>
        )}

        <div className="card" style={{ padding: 20 }}>
          <div className="stack" style={{ gap: 10 }}>
            <p style={{ margin: 0 }}>{x.intro}</p>
            <strong>En este video ves:</strong>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
              {x.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 6 }}>
              <a className="btn" href={DRIVE_DOCS} target="_blank" rel="noopener noreferrer">📁 Abrir carpeta de documentos (Drive)</a>
              {x.method && md && <a className="btn outline" href="/tutoriales/metodo" download="metodo-adscaler.md">⬇ Descargar el método (.md)</a>}
            </div>
          </div>
        </div>

        {x.method && md && (
          <div className="card" style={{ padding: 20 }}>
            <div className="stack" style={{ gap: 12 }}>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <strong style={{ fontSize: 18 }}>El método (markdown)</strong>
                <CopyButton text={md} label="Copiar todo el método" />
              </div>
              <p className="muted small" style={{ margin: 0 }}>
                Cómo usarlo: abre ChatGPT, sube este archivo (o pega el texto) y cuéntale qué anuncio quieres crear. Sigue las instrucciones que te va dando.
              </p>
              <pre style={{ margin: 0, padding: 14, background: "#f4f5f8", borderRadius: 6, maxHeight: 460, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 13, lineHeight: 1.5 }}>{md}</pre>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
