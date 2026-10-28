import Link from "next/link";
import { AppShell } from "@/components/ui";
import { TUTORIALES, videoId } from "@/lib/tutoriales";

// Los videos NO se guardan en el servidor (pesan mucho): están en YouTube como "no listado" y se muestran desde ahí.
export default function Tutoriales() {
  return (
    <AppShell>
      <div className="stack">
        <span className="muted small">Aprende a usarlo</span>
        <h1>Tutoriales</h1>
      </div>
      <div className="grid">
        {TUTORIALES.map((x) => {
          const id = videoId(x.link);
          return (
            <Link key={x.slug} href={`/tutoriales/${x.slug}`} className="card pcard" style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ position: "relative", aspectRatio: "16 / 9", background: "#000" }}>
                {id ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={x.t} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div className="ph" style={{ height: "100%", background: "var(--black)", color: "var(--soft)" }}>Video próximamente</div>
                )}
                {id && (
                  <span aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                    <span style={{ width: 56, height: 56, borderRadius: 28, background: "rgba(0,0,0,0.62)", color: "#fff", display: "grid", placeItems: "center", fontSize: 22, paddingLeft: 4 }}>▶</span>
                  </span>
                )}
              </div>
              <div className="stack" style={{ padding: 18, gap: 6 }}>
                <strong style={{ fontSize: 17 }}>{x.t}</strong>
                <span className="muted small">{x.d}</span>
                <span className="small" style={{ fontWeight: 700, color: "var(--accent)" }}>Ver tutorial →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
