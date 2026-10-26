import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, ownProject, canCreateVideos } from "@/lib/auth";
import { createVideo } from "@/app/actions";
import { SubmitButton, BriefPicker, RefVideoPicker } from "@/components/client";

export const dynamic = "force-dynamic";

export default async function NewVideo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const me = await requireUser();
  let project;
  try {
    project = ownProject(me, id);
  } catch {
    notFound();
  }

  if (!canCreateVideos(me)) {
    return (
      <div>
        <header className="topbar">
          <Link href={`/proyectos/${id}`} style={{ textDecoration: "none", fontWeight: 500 }}>← {project.name}</Link>
        </header>
        <div className="wrap" style={{ padding: "40px 24px 80px", maxWidth: 640 }}>
          <div className="card stack" style={{ gap: 12 }}>
            <h1 style={{ fontSize: 26 }}>Para crear videos necesitas un plan o un pack</h1>
            <p className="muted">Crear videos está disponible para quienes compran un video de prueba, un pack o un plan. Elige el tuyo y vuelve aquí.</p>
            <div><Link href="/planes" className="btn">Ver planes y precios</Link></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="topbar">
        <Link href={`/proyectos/${id}`} style={{ textDecoration: "none", fontWeight: 500 }}>← {project.name}</Link>
        <ol className="steps" aria-label="Pasos">
          <li className="on" aria-current="step">1 · Brief</li>
          <li>2 · Personaje</li>
          <li>3 · Primera toma</li>
          <li>4 · Entrega para Flow</li>
        </ol>
      </header>

      <div className="wrap" style={{ padding: "40px 24px 80px" }}>
        <form action={createVideo.bind(null, id)} className="cols">
          <div className="main stack-lg">
            <h1>Nuevo video</h1>
            {error && <div className="error" role="alert">{error}</div>}

            <label className="field">Nombre del video
              <input type="text" name="title" placeholder="Ej.: “Probé todas las cremas caras”" required />
            </label>

            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 600, marginBottom: 12 }}>1. ¿Qué tipo de video es?</legend>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label className="choice">
                  <input type="radio" name="type" value="ugc" defaultChecked />
                  <strong>UGC</strong>
                  <span className="muted small">Una persona habla a cámara como grabado con celular. Primero se crea y aprueba a la persona.</span>
                </label>
                <label className="choice">
                  <input type="radio" name="type" value="broll" />
                  <strong>B-roll</strong>
                  <span className="muted small">Voz en off sobre tomas: realista o animado. Nadie habla a cámara.</span>
                </label>
              </div>
            </fieldset>

            <fieldset className="stack broll-opts" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 600, marginBottom: 12 }}>¿Qué clase de B-roll?</legend>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label className="choice">
                  <input type="radio" name="mode" value="persona" />
                  <strong>Una persona fija</strong>
                  <span className="muted small">Realista. La misma persona en todo el video y una voz en off cuenta su historia. Se crea y aprueba la persona.</span>
                </label>
                <label className="choice">
                  <input type="radio" name="mode" value="cortes" defaultChecked />
                  <strong>Cortes variados</strong>
                  <span className="muted small">Realista. Cada toma es una escena distinta, sin persona fija. Cada imagen se crea por separado.</span>
                </label>
                <label className="choice">
                  <input type="radio" name="mode" value="animado_personaje" />
                  <strong>Animado · personaje fijo</strong>
                  <span className="muted small">Un mismo personaje animado en todo el video. Se crea y aprueba el personaje.</span>
                </label>
                <label className="choice">
                  <input type="radio" name="mode" value="animado_cortes" />
                  <strong>Animado · cortes variados</strong>
                  <span className="muted small">Escenas animadas distintas, con personajes distintos. Cada imagen se crea por separado.</span>
                </label>
              </div>
              <label className="choice" style={{ marginTop: 12 }}>
                <input type="checkbox" name="mainPerson" />
                <strong>Hay una persona (o personaje) principal que se repite</strong>
                <span className="muted small">Solo para los cortes variados. La eliges y apruebas al inicio, igual que en UGC, y se ve igual en todas las tomas donde aparece. Las otras personas pueden ser distintas.</span>
              </label>
              <div className="anim-style stack" style={{ marginTop: 8 }}>
                <label className="field">Estilo de animación
                  <select name="animStyle" defaultValue="Animación 3D estilo Pixar">
                    <option>Animación 3D estilo Pixar</option>
                    <option>Plastilina (clay motion)</option>
                    <option>Tela y fieltro (felt / stop motion)</option>
                    <option>Cómic 2D</option>
                    <option>Esqueleto IA (rayos X / anatomía)</option>
                  </select>
                </label>
                <label className="field">…o escribe el tuyo (opcional)
                  <input type="text" name="animStyleCustom" placeholder="Ej.: acuarela suave, colores pastel" />
                </label>
              </div>
            </fieldset>

            <label className="field">2. ¿A qué avatar le habla?
              <select name="avatarId" defaultValue={project.avatars[0]?.id ?? ""}>
                <option value="">Que la IA lo deduzca del brief</option>
                {project.avatars.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>

            <BriefPicker />

            <RefVideoPicker />

            <label className="field">5. ¿Algo más que deba saber la IA?
              <textarea name="notes" rows={3} placeholder="Ej.: que grabe en el baño de su casa, luz de mañana" />
            </label>

            <div>
              <SubmitButton className="btn big" pending="Subiendo el brief…">
                Analizar brief y crear prompts →
              </SubmitButton>
            </div>
          </div>

          <aside className="aside stack">
            <div className="card-dark stack">
              <h2 style={{ fontFamily: "var(--display)", fontSize: 20 }}>Lo que va a pasar</h2>
              <p className="muted small">La IA lee tu brief y escribe tres cosas:</p>
              <p><strong>Prompt del personaje</strong><br /><span className="muted small">la persona que aparece en todo el video</span></p>
              <p><strong>Prompt de imagen por toma</strong><br /><span className="muted small">cada escena, hiperrealista, con tu producto real</span></p>
              <p><strong>Prompt de animación por toma</strong><br /><span className="muted small">listo para pegar en Flow</span></p>
            </div>
            <p className="card muted small">Analizar el brief no gasta imágenes de tu plan.</p>
          </aside>
        </form>
      </div>
    </div>
  );
}
