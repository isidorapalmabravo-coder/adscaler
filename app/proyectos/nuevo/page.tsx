import Link from "next/link";
import { createProject } from "@/app/actions";
import { AppShell } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export const dynamic = "force-dynamic";

export default function NewProject() {
  return (
    <AppShell>
      <div className="crumb"><Link href="/">Proyectos</Link> / Nuevo producto</div>
      <h1>Nuevo producto</h1>
      <form action={createProject} className="card stack-lg" style={{ maxWidth: 760 }}>
        <label className="field">Nombre del producto
          <input type="text" name="name" required placeholder="Ej.: Crema antiarrugas" />
        </label>
        <label className="field">Qué es y qué hace
          <textarea name="description" rows={3} placeholder="Ej.: Sérum nocturno con retinol suave. Dos gotas en la noche." />
        </label>
        <label className="field">Oferta
          <input type="text" name="offer" placeholder="Ej.: 2x1 + envío gratis · 30 días de garantía" />
        </label>
        <label className="field">Lo que nunca se dice ni se muestra
          <input type="text" name="never" placeholder="Ej.: “elimina arrugas”, antes/después falsos" />
        </label>
        <div className="drop">
          <label className="field">Fotos reales del producto (frasco, caja, textura…)
            <input type="file" name="photos" accept="image/png,image/jpeg,image/webp" multiple />
          </label>
          <span className="muted small">Se usan como referencia en cada imagen para que el producto salga idéntico.</span>
        </div>
        <div className="row">
          <SubmitButton pending="Creando…">Crear producto</SubmitButton>
          <Link href="/" className="btn outline">Cancelar</Link>
        </div>
      </form>
    </AppShell>
  );
}
