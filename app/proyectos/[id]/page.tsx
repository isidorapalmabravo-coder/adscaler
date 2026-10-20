import Link from "next/link";
import { notFound } from "next/navigation";
import { read } from "@/lib/db";
import { requireUser, ownProject } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { addAvatar, deleteAvatar, generateAvatars, removePhoto, updateProject, deleteVideoQuiet, renameVideo } from "@/app/actions";
import { AppShell, StatusPill } from "@/components/ui";
import { ConfirmDeleteForm, EditableTitle, SubmitButton } from "@/components/client";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  let project;
  try {
    project = ownProject(me, id);
  } catch {
    notFound();
  }
  const videos = read((db) => db.videos.filter((v) => v.projectId === id));

  return (
    <AppShell>
      <div className="crumb"><Link href="/">Proyectos</Link> / {project.name}</div>
      <header className="row between" style={{ alignItems: "flex-end" }}>
        <h1>{project.name}</h1>
        <Link href={`/proyectos/${id}/videos/nuevo`} className="btn big">+ Crear video</Link>
      </header>

      <div className="cols">
        <form action={updateProject.bind(null, id)} className="card stack-lg main">
          <h2>El producto</h2>
          <div className="stack" style={{ gap: 8 }}>
            <span className="small muted" style={{ fontWeight: 600 }}>Fotos reales del producto</span>
            <div className="row" style={{ gap: 10 }}>
              {project.photos.map((ph) => (
                <div key={ph} className="stack" style={{ gap: 4 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(ph)} alt="Foto del producto" className="photo" />
                  <button formAction={removePhoto.bind(null, id, ph)} className="btn ghost small" style={{ minHeight: 28, padding: 2 }}>Quitar</button>
                </div>
              ))}
              {project.photos.length === 0 && <span className="muted small">Aún no hay fotos. Súbelas para que el producto salga igual en cada toma.</span>}
            </div>
            <input type="file" name="photos" accept="image/png,image/jpeg,image/webp" multiple aria-label="Subir más fotos" />
          </div>
          <label className="field">Nombre
            <input type="text" name="name" defaultValue={project.name} />
          </label>
          <label className="field">Qué es y qué hace
            <textarea name="description" rows={3} defaultValue={project.description} />
          </label>
          <label className="field">Oferta
            <input type="text" name="offer" defaultValue={project.offer} />
          </label>
          <label className="field">Lo que nunca se dice ni se muestra
            <input type="text" name="never" defaultValue={project.never} />
          </label>
          <div><SubmitButton pending="Guardando…" className="btn outline">Guardar cambios</SubmitButton></div>
        </form>

        <section className="card stack-lg aside">
          <div className="row between">
            <h2>Avatares</h2>
            <span className="pill dim">con Gemini</span>
          </div>
          <p className="muted small">A quién le hablas cambia todo: la persona que aparece, cómo habla y dónde graba.</p>
          {project.avatars.map((a) => (
            <div key={a.id} className="card stack" style={{ padding: 16, gap: 6 }}>
              <strong>{a.name}</strong>
              <p className="muted small">{a.description}</p>
              <form action={deleteAvatar.bind(null, id, a.id)}>
                <button className="btn ghost small" style={{ padding: 0, minHeight: 24 }}>Eliminar</button>
              </form>
            </div>
          ))}
          <form action={generateAvatars.bind(null, id)}>
            <SubmitButton pending="Pensando avatares…">Proponer 3 avatares con IA</SubmitButton>
          </form>
          <details>
            <summary>Agregar avatar a mano</summary>
            <form action={addAvatar.bind(null, id)} className="stack" style={{ marginTop: 12 }}>
              <input type="text" name="name" placeholder="Carmen, 58 · “Me veo cansada en las fotos”" aria-label="Nombre del avatar" required />
              <textarea name="description" rows={3} placeholder="Quién es, qué le pasa, qué la frena" aria-label="Descripción del avatar" />
              <div><SubmitButton className="btn outline">Agregar</SubmitButton></div>
            </form>
          </details>
        </section>
      </div>

      <section className="card stack">
        <h2>Videos de este producto</h2>
        {videos.length === 0 ? (
          <div className="empty-videos">
            <p className="muted">Todavía no hay videos de este producto.</p>
            <Link href={`/proyectos/${id}/videos/nuevo`} className="btn big xl">+ Crear el primer video</Link>
          </div>
        ) : (
          <div className="table-box">
            <table>
              <thead>
                <tr><th>Video</th><th>Tipo</th><th>Avatar</th><th>Tomas</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.id}>
                    <td><EditableTitle value={v.title} href={`/videos/${v.id}`} onSave={renameVideo.bind(null, v.id)} /></td>
                    <td>{v.type === "ugc" ? "UGC" : "B-roll"}</td>
                    <td>{project.avatars.find((a) => a.id === v.avatarId)?.name.split("·")[0] ?? "—"}</td>
                    <td>{v.analysis?.shots.length ?? "—"}</td>
                    <td><StatusPill status={v.status} /></td>
                    <td className="actions">
                      <ConfirmDeleteForm icon action={deleteVideoQuiet.bind(null, v.id)} label="Eliminar video" message="¿Seguro que quieres eliminar este video?" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
