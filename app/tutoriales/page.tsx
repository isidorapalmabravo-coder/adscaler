import { AppShell } from "@/components/ui";

// Los videos NO se guardan en el servidor (pesan mucho): se suben a YouTube como "no listado" y aquí solo se pega el enlace.
// Para activar uno, pon en "link" la dirección del video de YouTube o Vimeo (ej.: "https://youtu.be/AbC123xyz").
const TUTORIALES: { t: string; d: string; link?: string }[] = [
  { t: "Tutorial 1 · Bienvenida", d: "Qué es la web, proyectos, el editor, dónde se guardan los videos, los planes y el método para el brief.", link: "https://youtu.be/2GPLsfqjJ2w?si=e6nL6cbMIiT-TKNe" },
  { t: "Tutorial 2 · UGC", d: "Cómo funciona un video con una persona hablando a cámara.", link: "https://youtu.be/oUoAQW6hX_A?si=02_p2t48kjgKn7ry" },
  { t: "Tutorial 3 · B-roll", d: "Planos de producto con voz en off.", link: "https://youtu.be/PiAcl4REsRI?si=51bJWnuKX0OG9znk" },
  { t: "Tutorial 4 · Editor", d: "Une los clips de Flow, subtítulos y texto sobre el video.", link: "https://youtu.be/1Ow8toKjz44?si=NKJcqPEzUML3-jgW" },
];

function embedUrl(link?: string): string | null {
  if (!link) return null;
  try {
    const u = new URL(link.trim());
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (h === "youtube.com" || h === "m.youtube.com") {
      const id = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (h === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}${u.pathname.split("/")[2] ? `?h=${u.pathname.split("/")[2]}` : ""}` : null;
    }
  } catch {}
  return null;
}

export default function Tutoriales() {
  return (
    <AppShell>
      <div className="stack">
        <span className="muted small">Aprende a usarlo</span>
        <h1>Tutoriales</h1>
      </div>
      <div className="grid">
        {TUTORIALES.map((x) => {
          const src = embedUrl(x.link);
          return (
            <div key={x.t} className="card pcard">
              {src ? (
                <iframe src={src} title={x.t} loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen style={{ width: "100%", aspectRatio: "16 / 9", border: 0, background: "#000" }} />
              ) : (
                <div className="ph" style={{ height: 150, background: "var(--black)", color: "var(--soft)" }}>Video próximamente</div>
              )}
              <div className="stack" style={{ padding: 18, gap: 6 }}>
                <strong style={{ fontSize: 17 }}>{x.t}</strong>
                <span className="muted small">{x.d}</span>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
