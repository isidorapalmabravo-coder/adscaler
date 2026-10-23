import { read, imagesThisMonth } from "@/lib/db";
import { pagosRecientes } from "@/lib/pagos";
import { clp } from "@/lib/plans";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { updateUser } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const me = await requireAdmin();
  const users = read((db) => db.users);
  const pagos = pagosRecientes();
  return (
    <AppShell>
      <div className="stack" style={{ gap: 6 }}>
        <span className="muted small">Solo administradores</span>
        <h1>Usuarios</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Cambia el plan y las imágenes al mes de cada cuenta. Hasta que haya pagos automáticos, cuando alguien pague le subes el cupo aquí.
        </p>
      </div>
      <div className="stack">
        {users.map((u) => (
          <form key={u.id} action={updateUser.bind(null, u.id)} className="card row" style={{ gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="stack" style={{ gap: 2, minWidth: 220 }}>
              <strong>{u.name}{u.role === "admin" && " · admin"}</strong>
              <span className="muted small">{u.email}</span>
              <span className="muted small">Usó {imagesThisMonth(u.id, u.role === "admin")} imágenes este mes</span>
            </div>
            <label className="field" style={{ margin: 0 }}>
              Plan
              <input type="text" name="plan" defaultValue={u.plan} style={{ width: 140 }} />
            </label>
            <label className="field" style={{ margin: 0 }}>
              Imágenes al mes
              <input type="number" name="imageLimit" min={0} defaultValue={u.imageLimit} style={{ width: 120 }} />
            </label>
            {u.id !== me.id && (
              <label className="row small" style={{ gap: 6 }}>
                <input type="checkbox" name="disabled" defaultChecked={!!u.disabled} /> Desactivada
              </label>
            )}
            <SubmitButton className="btn outline" pending="Guardando…">Guardar</SubmitButton>
          </form>
        ))}
      </div>
      <div className="stack" style={{ marginTop: 28 }}>
        <h2>Pagos recientes</h2>
        {pagos.length === 0 ? (
          <span className="muted small">Todavía no hay pagos.</span>
        ) : (
          <div className="card stack" style={{ gap: 8 }}>
            {pagos.map((p) => (
              <div key={p.id} className="row between small" style={{ gap: 12, flexWrap: "wrap" }}>
                <span>{new Date(p.at).toLocaleString("es-CL")} · {users.find((u) => u.id === p.userId)?.email ?? p.userId}</span>
                <span><strong>{clp(p.amount)}</strong> · {p.kind === "plan" ? `Plan ${p.item}` : p.kind === "pack" ? `Pack ${p.item}` : "Video de prueba"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
