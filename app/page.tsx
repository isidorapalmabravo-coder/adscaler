import Link from "next/link";
import { read } from "@/lib/db";
import { fileUrl } from "@/lib/files";
import { AppShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await requireUser();
  const { projects, videos } = read((db) => {
    const projects = db.projects.filter((p) => p.ownerId === me.id);
    const ids = new Set(projects.map((p) => p.id));
    return { projects, videos: db.videos.filter((v) => ids.has(v.projectId)) };
  });
  return (
    <AppShell>
      <header className="row between" style={{ alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted small">Hola, {me.name}</span>
          <h1>Tus productos</h1>
        </div>
        <Link href="/proyectos/nuevo" className="btn">+ Nuevo producto</Link>
      </header>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
        {projects.map((p) => {
          const vs = videos.filter((v) => v.projectId === p.id);
          const ready = vs.filter((v) => v.status === "done").length;
          const names = p.avatars.map((a) => a.name).filter(Boolean).slice(0, 2).join(", ");
          return (
            <Link key={p.id} href={`/proyectos/${p.id}`} className="card pcard">
              {p.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(p.photos[0])} alt="" style={{ width: "100%", height: 180, objectFit: "cover", display: "block", borderBottom: "1px solid var(--line)" }} />
              ) : (
                <div className="ph" style={{ height: 180 }}>[Foto del producto]</div>
              )}
              <div className="stack" style={{ padding: 18, gap: 8 }}>
                <strong style={{ fontSize: 17 }}>{p.name}</strong>
                <span className="muted small">
                  {p.avatars.length
                    ? `${p.avatars.length} avatar${p.avatars.length > 1 ? "es" : ""}${names ? ` · ${names}` : ""}`
                    : "Avatar sin definir"}
                </span>
                <div className="row" style={{ gap: 8 }}>
                  {vs.length === 0 && <span className="pill dim">Sin videos aún</span>}
                  {ready > 0 && <span className="pill solid">{ready} listo{ready > 1 ? "s" : ""} para Flow</span>}
                  {vs.length - ready > 0 && <span className="pill">{vs.length - ready} en revisión</span>}
                </div>
              </div>
            </Link>
          );
        })}
        <Link href="/proyectos/nuevo" className="add-card">
          <span>+</span>
          Agregar producto
        </Link>
      </div>

      <section className="card row" style={{ gap: 24, padding: 24, alignItems: "center" }}>
        <div className="stack" style={{ flex: "1 1 320px", gap: 8 }}>
          <h2 style={{ fontFamily: "var(--display)", fontSize: 24, fontWeight: 700 }}>¿Primera vez? Mira cómo se hace un video completo</h2>
          <p className="muted">Del brief a Flow en 4 pasos: subes el brief, apruebas a la persona, apruebas la primera toma y copias los prompts de animación.</p>
        </div>
        <div className="tut">
          <Link href="/tutoriales">Tutorial 1 · 4 min</Link>
          <Link href="/tutoriales">Tutorial 2 · UGC</Link>
          <Link href="/tutoriales">Tutorial 3 · B-roll</Link>
        </div>
      </section>
    </AppShell>
  );
}
