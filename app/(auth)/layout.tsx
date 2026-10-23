/* eslint-disable @next/next/no-img-element */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-brand">
        <img src="/logo/adscaler-oscuro.svg" alt="Adscaler" height={34} style={{ height: 34, width: "auto", position: "relative", zIndex: 1 }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2>De tu producto a un video que vende, en minutos.</h2>
          <p>Escribe tu brief y Adscaler crea la persona, las imágenes de cada toma y los prompts listos para animar en Flow. Después le pones voz y subtítulos.</p>
        </div>
        <ul className="auth-points">
          <li>Personaje y producto iguales en todas las tomas</li>
          <li>Prompts de animación listos para copiar a Flow</li>
          <li>Editor con voz en off natural y subtítulos</li>
        </ul>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <img className="auth-logo-m" src="/logo/adscaler-claro.svg" alt="Adscaler" height={32} style={{ height: 32, width: "auto" }} />
          {children}
        </div>
      </main>
    </div>
  );
}
