import Link from "next/link";
import { read } from "@/lib/db";
import { AppShell } from "@/components/ui";
import { purgeOldEdits, expiresAt, RETENTION_DAYS } from "@/lib/video-edit";
import { SubmitButton } from "@/components/client";
import { createEdit } from "./actions";
import { requireUser, canUseEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("es-CL", { day: "numeric", month: "short" }).replace(".", "");

export default async function Editor() {
  purgeOldEdits();
  const me = await requireUser();
  const { edits, videos } = read((db) => {
    const ids = new Set(db.projects.filter((p) => p.ownerId === me.id).map((p) => p.id));
    return { edits: db.edits.filter((e) => e.ownerId === me.id), videos: db.videos.filter((v) => ids.has(v.projectId)) };
  });
  const withScript = videos.filter((v) => v.analysis?.shots?.length);
  if (!canUseEditor(me)) {
    return (
      <AppShell>
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted small">Después de Flow</span>
          <h1>Editor de video</h1>
        </div>
        <div className="card stack" style={{ gap: 12, maxWidth: 640 }}>
          <h2>El editor se activa cuando creas tu primer video</h2>
          <p className="muted">Sirve para unir los clips que bajas de Google Flow. Crea un video en Adscaler, que te entrega los prompts para Flow, y después podrás usar el editor.</p>
          <div className="row" style={{ gap: 10 }}>
            <Link href="/" className="btn">Ir a mis productos</Link>
            <Link href="/planes" className="btn outline">Ver planes</Link>
          </div>
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <div className="stack" style={{ gap: 6 }}>
        <span className="muted small">Después de Flow</span>
        <h1>Editor de video</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Sube los clips que bajaste de Google Flow y la app los une en orden, en vertical 9:16, con subtítulos. Los clips y el video final se guardan {RETENTION_DAYS} días y después se borran solos.
        </p>
      </div>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        <form action={createEdit} className="card stack" style={{ padding: 22, gap: 14 }}>
          <div className="stack" style={{ gap: 4 }}>
            <strong style={{ fontSize: 17 }}>1 · Desde un video de la app</strong>
            <span className="muted small">Trae el guion de cada toma, en orden.</span>
          </div>
          <select name="videoId" required defaultValue="" aria-label="Video" style={{ padding: 12, borderRadius: 6, border: "1px solid var(--line)", font: "inherit", background: "#fff" }}>
            <option value="" disabled>
              {withScript.length ? "Elige un video…" : "Aún no tienes videos analizados"}
            </option>
            {withScript.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title} · {v.analysis!.shots.length} tomas
              </option>
            ))}
          </select>
          <SubmitButton pending="Creando…" disabled={!withScript.length}>Crear montaje</SubmitButton>
        </form>

        <form action={createEdit} className="card stack" style={{ padding: 22, gap: 14 }}>
          <div className="stack" style={{ gap: 4 }}>
            <strong style={{ fontSize: 17 }}>2 · Pegar un guion</strong>
            <span className="muted small">Una línea por toma. Sirve para videos hechos fuera de la app.</span>
          </div>
          <input name="title" placeholder="Nombre del video (opcional)" style={{ padding: 12, borderRadius: 6, border: "1px solid var(--line)", font: "inherit" }} />
 <select name="kind" defaultValue="ugc" aria-label="Tipo de video" style={{ padding: 12, borderRadius: 6, border: "1px solid var(--line)", font: "inherit", background: "#fff" }}>
            <option value="ugc">UGC · la persona habla en el clip</option>
            <option value="broll">B-roll · voz en off sobre imágenes</option>
          </select>
          <textarea name="script" rows={4} placeholder={"Si tu cuello se ve así…\nNo es la edad, es esto…"} style={{ padding: 12, borderRadius: 6, border: "1px solid var(--line)", font: "inherit", resize: "vertical" }} />
          <SubmitButton pending="Creando…">Crear montaje</SubmitButton>
        </form>
      </section>

      <section className="stack" style={{ gap: 14 }}>
        <h2>Tus montajes</h2>
        {edits.length === 0 && <p className="muted">Todavía no tienes montajes. Crea el primero arriba.</p>}
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {edits.map((e) => {
            const have = e.slots.filter((s) => s.clip).length;
            return (
              <Link key={e.id} href={`/editor/${e.id}`} className="card stack" style={{ padding: 18, gap: 8, textDecoration: "none" }}>
                <strong style={{ fontSize: 16 }}>{e.title}</strong>
                <span className="muted small">
                  {have} de {e.slots.length} clips subidos
                </span>
                <div className="row" style={{ gap: 8 }}>
                  {e.status === "done" ? <span className="pill solid">Video listo</span> : e.status === "rendering" ? <span className="pill">Creando…</span> : e.status === "error" ? <span className="pill dim">Error</span> : <span className="pill dim">En preparación</span>}
                </div>
                <span className="muted small">Se borra el {fmt(expiresAt(e))}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
