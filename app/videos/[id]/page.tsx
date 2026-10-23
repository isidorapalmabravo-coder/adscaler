import { MODE_LABEL, hasCharacter } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, mutate } from "@/lib/db";
import { requireUser, ownVideo } from "@/lib/auth";
import { silenceBroll, noCameraImage } from "@/lib/broll";
import { fileUrl } from "@/lib/files";
import {
  approveFirstShot,
  approvePersona,
  deleteVideo,
  generatePersonas,
  generateShot,
  reanalyze,
  regenerateAnimation,
  renameVideo,
  setStatus,
} from "@/app/actions";
import { Stepper } from "@/components/ui";
import { AnalyzingPanel, ConfirmDeleteForm, EditableTitle, CopyButton, SubmitButton, TimedProgress } from "@/components/client";
import type { Project, Shot, Understanding, Video } from "@/lib/types";

export const dynamic = "force-dynamic";

/* eslint-disable @next/next/no-img-element */

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  let video;
  try {
    video = ownVideo(me, id);
  } catch {
    notFound();
  }
  const project = getProject(video.projectId)!;
  const avatar = project.avatars.find((a) => a.id === video.avatarId);
  const a = video.analysis;
  // Si saliste de la página mientras se creaban las tomas, el aviso "listo" pudo no guardarse aunque
  // las imágenes sí quedaron hechas: si todas las tomas tienen imagen, el video está listo para Flow.
  const shots = a?.shots ?? [];
  if (video.status === "persona_approved" && shots.length > 1 && shots.every((s) => s.image)) {
    mutate((db) => {
      const v = db.videos.find((x) => x.id === id);
      if (v) v.status = "done";
    });
    video.status = "done";
  }
  // B-roll: los prompts de animación ya guardados se corrigen solos (nadie habla ni mira a cámara)
  if (video.type !== "ugc" && shots.some((s) => s.animationPrompt && !/nobody looks at the camera/i.test(s.animationPrompt))) {
    mutate((db) => {
      const v = db.videos.find((x) => x.id === id);
      v?.analysis?.shots.forEach((s) => {
        if (s.animationPrompt) s.animationPrompt = silenceBroll(s.animationPrompt);
        if (s.imagePrompt) s.imagePrompt = noCameraImage(s.imagePrompt);
      });
    });
    shots.forEach((s) => {
      if (s.animationPrompt) s.animationPrompt = silenceBroll(s.animationPrompt);
      if (s.imagePrompt) s.imagePrompt = noCameraImage(s.imagePrompt);
    });
  }
  // Si el servidor se reinició a mitad del análisis, tras 6 min se considera interrumpido
  const analyzing = !!video.analyzingSince && Date.now() - Date.parse(video.analyzingSince) < 6 * 60 * 1000;
  const interrupted = !!video.analyzingSince && !analyzing;

  return (
    <div>
      <header className="topbar">
        <Link href={`/proyectos/${project.id}`} style={{ textDecoration: "none", fontWeight: 500 }}>← {project.name}</Link>
        <Stepper status={video.status} type={video.type} mode={video.mode} />
      </header>

      <div className="wrap stack-lg" style={{ padding: "32px 24px 80px" }}>
        {a && (
          <div className="card row small" style={{ padding: "12px 18px", gap: 18 }}>
            <EditableTitle value={video.title} onSave={renameVideo.bind(null, video.id)} />
            <span>{video.type === "ugc" ? "UGC" : MODE_LABEL[video.mode ?? "cortes"]}{video.animStyle ? ` · ${video.animStyle}` : ""}</span>
            <span>{a.shots.length} tomas</span>
            {a.durationSeconds > 0 && <span title="Suma de los clips que vas a generar en Flow (cada segundo gasta créditos)">{Math.round(a.durationSeconds)} s en Flow</span>}
            {avatar && <span>Avatar: {avatar.name.split("·")[0]}</span>}
            <details style={{ flexBasis: "100%" }}>
              <summary>Lo que entendió la IA</summary>
              <p className="muted" style={{ marginTop: 8 }}>{a.summary}</p>
              {a.understanding && <Understood u={a.understanding} />}
            </details>
          </div>
        )}

        {video.error && <div className="error" role="alert">{video.error}</div>}

        {video.status === "draft" && analyzing && (
          <AnalyzingPanel
            startedAt={video.analyzingSince!}
            retry={
              <form action={reanalyze.bind(null, video.id)}>
                <SubmitButton pending="Reintentando…">Reintentar</SubmitButton>
              </form>
            }
          />
        )}
        {video.status === "draft" && !analyzing && <DraftStep video={video} interrupted={interrupted} />}
        {video.status === "analyzed" && a && <PersonaStep video={video} />}
        {video.status === "persona_approved" && a && <FirstShotStep video={video} />}
        {video.status === "done" && a && <DeliveryStep video={video} project={project} />}

        <div style={{ marginTop: 40 }}>
          <ConfirmDeleteForm
            action={deleteVideo.bind(null, video.id)}
            label="Eliminar este video"
            message="¿Estás seguro de que quieres eliminar este video? Se borran sus imágenes y prompts y no se puede deshacer."
          />
        </div>
      </div>
    </div>
  );
}

function Understood({ u }: { u: Understanding }) {
  const rows: [string, string][] = [
    ["Idea central", u.promise],
    ["Tono y ritmo", u.tone],
    ["Cómo parte", u.hook],
    ["Continuidad entre tomas", u.continuity],
    ["Videos de referencia", u.referenceStyle],
    ["Producto (lo que ve la IA)", u.productLook],
  ];
  return (
    <div className="stack small" style={{ marginTop: 10, gap: 8 }}>
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k}><strong>{k}:</strong> <span className="muted">{v}</span></div>
      ))}
      {u.rules.length > 0 && (
        <div>
          <strong>Reglas del brief que se cumplen en todas las tomas:</strong>
          <ul style={{ margin: "4px 0 0 18px" }}>{u.rules.map((r, i) => <li key={i} className="muted">{r}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function DraftStep({ video, interrupted }: { video: Video; interrupted?: boolean }) {
  return (
    <div className="empty">
      <h2>El brief todavía no está analizado</h2>
      <p>{interrupted ? "El análisis se interrumpió (puede haberse reiniciado el servidor). Vuelve a intentarlo: no gasta imágenes." : video.error ? "El análisis anterior no terminó. Inténtalo otra vez." : "Puede haber fallado la conexión con la IA. Inténtalo otra vez."}</p>
      <form action={reanalyze.bind(null, video.id)}>
        <SubmitButton pending="Iniciando…">Analizar brief</SubmitButton>
      </form>
    </div>
  );
}

function PersonaStep({ video }: { video: Video }) {
  const a = video.analysis!;
  return (
    <>
      <div className="stack" style={{ gap: 6 }}>
        <h1>¿Esta es la persona?</h1>
        <p className="muted">Elige una. Va a aparecer igual en todas las tomas del video.</p>
      </div>
      <div className="cols">
        <section className="main stack-lg">
          {video.personaImages.length === 0 ? (
            <div className="empty">
              <p>Revisa el prompt de la derecha y genera las primeras 2 opciones.</p>
            </div>
          ) : (
            <form action={approvePersona.bind(null, video.id)} className="stack-lg">
              <div className="grid-4">
                {video.personaImages.map((img, i) => (
                  <label key={img} className="pick">
                    <input type="radio" name="chosen" value={img} defaultChecked={i === 0} />
                    <img src={fileUrl(img)} alt={`Opción ${i + 1} del personaje`} className="thumb" />
                    <span className="small muted">Opción {i + 1}</span>
                  </label>
                ))}
              </div>
              <div>
                <SubmitButton className="btn big">Aprobar persona y pasar a la primera toma →</SubmitButton>
              </div>
            </form>
          )}
        </section>

        <aside className="aside">
          <form action={generatePersonas.bind(null, video.id)} className="card stack">
            <label className="field">Prompt del personaje (editable)
              <textarea name="personaPrompt" rows={12} className="mono-input" defaultValue={a.personaPrompt} />
            </label>
            <label className="field">Cambiar algo con palabras
              <input type="text" name="tweak" placeholder="Ej.: más canas, polera azul" />
            </label>
            <SubmitButton pending="Generando 2 opciones… (≈30 s)">
              {video.personaImages.length ? "Generar 2 más" : "Generar 2 opciones"}
            </SubmitButton>
            <TimedProgress expectedSeconds={40} stages={["Creando las opciones", "Terminando"]} hint="Suele tardar unos 30 s." />
            <span className="muted small">Cada opción usa 1 imagen de tu plan.</span>
          </form>
        </aside>
      </div>
    </>
  );
}

function HqCheck() {
  return (
    <label className="row small" style={{ gap: 8, alignItems: "center" }}>
      <input type="checkbox" name="hq" />
      <span>Mayor calidad <span className="muted">(gasta 3 imágenes de tu plan)</span></span>
    </label>
  );
}

function ShotPrompts({ shot, character }: { shot: Shot; character?: boolean }) {
  return (
    <>
      <input type="hidden" name="flags" value="1" />
      <div className="row" style={{ gap: 20 }}>
        {character && (
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" name="showsCharacter" defaultChecked={shot.showsCharacter !== false} />
            <span>Se ve la persona / el personaje</span>
          </label>
        )}
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" name="showsProduct" defaultChecked={shot.showsProduct !== false} />
          <span>Se ve el producto</span>
        </label>
      </div>
      <label className="field">Prompt de imagen
        <textarea name="imagePrompt" rows={7} className="mono-input" defaultValue={shot.imagePrompt} />
      </label>
      <label className="field">Prompt de animación · para Flow
        <textarea name="animationPrompt" rows={4} className="mono-input" defaultValue={shot.animationPrompt} />
      </label>
    </>
  );
}

function FirstShotStep({ video }: { video: Video }) {
  const a = video.analysis!;
  const shot = a.shots[0];
  if (!shot) return <div className="error">La IA no devolvió tomas. Vuelve a analizar el brief.</div>;
  const rest = a.shots.length - 1;
  return (
    <>
      <div className="stack" style={{ gap: 6 }}>
        <h1>¿Se ve bien la primera toma?</h1>
        <p className="muted">Revisa que la persona y el producto se vean reales. Si está bien, se crean todas las demás igual.</p>
      </div>
      <div className="cols">
        <section className="aside stack" style={{ maxWidth: 400 }}>
          {shot.image ? (
            <img src={fileUrl(shot.image)} alt="Toma 1" className="thumb" />
          ) : (
            <div className="thumb-empty">Aún no se genera la imagen de la toma 1</div>
          )}
          <div className="row small" style={{ gap: 8 }}>
            <span className="muted">Referencias:</span>
            {video.personaChosen && <span className="pill">Personaje aprobado</span>}
            <span className="pill">Fotos del producto</span>
          </div>
        </section>

        <section className="main stack-lg">
          <div className="card stack" style={{ gap: 6 }}>
            <span className="muted small">Toma 1 · {shot.time} · {shot.duration} · {shot.kind}</span>
            <p style={{ fontSize: 20, fontWeight: 600 }}>“{shot.audio}”</p>
            <span className="muted small">Audio del brief (lo grabas aparte)</span>
          </div>

          <form action={generateShot.bind(null, video.id, shot.n)} className="stack-lg">
            <ShotPrompts shot={shot} character={hasCharacter(video.type, video.mode)} />
            <label className="field">¿Qué cambiarías? (opcional)
              <input type="text" name="tweak" placeholder="Ej.: que el baño se vea más sencillo" />
            </label>
            <HqCheck />
            <div className="row">
              <SubmitButton className={shot.image ? "btn outline" : "btn big"} pending="Generando imagen… (≈30 s)">
                {shot.image ? "Regenerar" : "Generar la primera toma"}
              </SubmitButton>
              {hasCharacter(video.type, video.mode) && (
                <button formAction={setStatus.bind(null, video.id, "analyzed")} className="btn ghost">← Cambiar personaje</button>
              )}
            </div>
            <TimedProgress expectedSeconds={35} stages={["Generando la imagen", "Terminando"]} hint="Suele tardar unos 30 s." />
          </form>

          {shot.image && (
            <form action={approveFirstShot.bind(null, video.id)} className="stack" style={{ gap: 6 }}>
              <div>
                <SubmitButton className="btn big" pending={`Generando ${rest} tomas… (puede tardar unos minutos)`}>
                  Se ve bien · crear las {rest} tomas restantes →
                </SubmitButton>
              </div>
              <TimedProgress
                expectedSeconds={Math.max(40, Math.ceil(rest / 3) * 40)}
                stages={["Generando las imágenes", "Revisando las tomas", "Terminando"]}
                hint="Se generan de a 3 a la vez. No cierres esta página."
              />
              <span className="muted small">Usará {rest} imágenes de tu plan.</span>
            </form>
          )}

          <details className="card">
            <summary>Ver todas las tomas planificadas ({a.shots.length})</summary>
            <div className="stack" style={{ marginTop: 14 }}>
              {a.shots.map((s) => (
                <div key={s.n} className="small" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <strong>Toma {s.n}</strong> · {s.time} · {s.duration} — “{s.audio}”
                </div>
              ))}
            </div>
          </details>
        </section>
      </div>
    </>
  );
}

function DeliveryStep({ video }: { video: Video; project: Project }) {
  const a = video.analysis!;
  const all = a.shots.map((s) => `TOMA ${s.n} (${s.time} · ${s.duration})\n${s.animationPrompt}`).join("\n\n");
  // Solo lo que se dice, toma por toma, sin visual ni prompts: para pegar en ElevenLabs u otra IA de voz
  const script = a.shots.map((s) => s.audio.trim()).filter(Boolean).join("\n\n");
  return (
    <>
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted">Listo para Flow</span>
          <h1>{video.title}</h1>
        </div>
        <div className="row">
          <a href={`/api/videos/${video.id}/zip`} className="btn">Descargar todo (ZIP)</a>
          <CopyButton text={all} label="Copiar todos los prompts" />
        </div>
      </div>

      <section className="card stack">
        <div className="row between" style={{ alignItems: "center" }}>
          <div className="stack" style={{ gap: 4 }}>
            <h2>Guion para la voz</h2>
            <span className="muted small">Solo lo que se dice, toma por toma. Cópialo y pégalo en ElevenLabs o la IA de voz que uses.</span>
          </div>
          <CopyButton text={script} label="Copiar guion" className="btn" />
        </div>
        <textarea className="script-box" readOnly value={script} aria-label="Guion para la voz" />
      </section>

      <div className="card-dark row" style={{ gap: 24 }}>
        <strong style={{ fontFamily: "var(--display)", fontSize: 18 }}>En Flow, por cada toma:</strong>
        <span>1 · Sube la imagen como primer cuadro</span>
        <span>2 · Pega el prompt de animación</span>
        <span>3 · Genera y recorta a la duración indicada</span>
      </div>

      <div className="stack">
        {a.shots.map((s) => (
          <article key={s.n} className="card shot">
            <div className="img">
              {s.image ? <img src={fileUrl(s.image)} alt={`Toma ${s.n}`} className="thumb" /> : <div className="thumb-empty">Sin imagen</div>}
            </div>
            <div className="body">
              <div className="row" style={{ alignItems: "baseline" }}>
                <span className="shot-title">Toma {s.n}</span>
                <span className="muted small">{s.time} · {s.duration} · {s.kind}</span>
              </div>
              <p style={{ fontSize: 16 }}>“{s.audio}”</p>
              <div className="mono">{s.animationPrompt}</div>
              {s.edit && <span className="muted small">Edición: {s.edit}</span>}
            </div>
            <div className="acts">
              <CopyButton text={s.animationPrompt} label="Copiar prompt de animación" className="btn" />
              {s.image && (
                <a href={fileUrl(s.image)} download={`toma-${String(s.n).padStart(2, "0")}`} className="btn outline">Descargar imagen</a>
              )}
              <details>
                <summary className="small">Regenerar prompt de animación</summary>
                <form action={regenerateAnimation.bind(null, video.id, s.n)} className="stack" style={{ marginTop: 10 }}>
                  <input type="text" name="change" placeholder="¿Qué cambiarías? (opcional)" aria-label={`Cambio al prompt de animación de la toma ${s.n}`} />
                  <SubmitButton className="btn outline" pending="Escribiendo…">Regenerar prompt</SubmitButton>
                </form>
              </details>
              <details>
                <summary className="small">Regenerar esta toma</summary>
                <form action={generateShot.bind(null, video.id, s.n)} className="stack" style={{ marginTop: 10 }}>
                  <input type="text" name="tweak" placeholder="¿Qué cambio?" aria-label={`Cambio para la toma ${s.n}`} />
                  <HqCheck />
                  <SubmitButton className="btn outline" pending="Generando…">Regenerar</SubmitButton>
                </form>
              </details>
            </div>
          </article>
        ))}
      </div>

      <form action={setStatus.bind(null, video.id, "persona_approved")}>
        <button className="btn ghost">← Volver a la primera toma</button>
      </form>
    </>
  );
}
