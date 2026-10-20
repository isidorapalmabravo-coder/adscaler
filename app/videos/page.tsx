import { ConfirmDeleteForm, EditableTitle } from "@/components/client";
import { deleteVideoQuiet, renameVideo } from "@/app/actions";
import Link from "next/link";
import { read } from "@/lib/db";
import { AppShell, StatusPill } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TodosLosVideos() {
  const me = await requireUser();
  const { projects, videos } = read((db) => {
    const projects = db.projects.filter((p) => p.ownerId === me.id);
    const ids = new Set(projects.map((p) => p.id));
    return { projects, videos: db.videos.filter((v) => ids.has(v.projectId)) };
  });
  const list = [...videos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <AppShell>
      <div className="stack">
        <span className="muted small">De todos tus productos</span>
        <h1>Todos los videos</h1>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <h2>Todavía no tienes videos</h2>
          <p>Entra a un producto y crea tu primer video.</p>
          <Link href="/" className="btn">Ir a mis productos</Link>
        </div>
      ) : (
        <div className="card table-box">
          <table>
            <thead>
              <tr><th>Video</th><th>Producto</th><th>Tipo</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id}>
                  <td><EditableTitle value={v.title} href={`/videos/${v.id}`} onSave={renameVideo.bind(null, v.id)} /></td>
                  <td>{projects.find((p) => p.id === v.projectId)?.name ?? "—"}</td>
                  <td>{v.type === "ugc" ? "UGC" : "B-roll"}</td>
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
    </AppShell>
  );
}
