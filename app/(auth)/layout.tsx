/* eslint-disable @next/next/no-img-element */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card stack" style={{ width: "100%", maxWidth: 420, padding: 28, gap: 18 }}>
        <img src="/logo/adscaler-claro.svg" alt="Adscaler" height={36} style={{ height: 36, width: "auto" }} />
        {children}
      </div>
    </div>
  );
}
