import Link from "next/link";

export function LegalPage({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 80px" }}>
      <p className="small"><Link href="/">← Volver a Adscaler</Link></p>
      <h1 style={{ margin: "16px 0 6px" }}>{titulo}</h1>
      <div className="stack-lg legal">{children}</div>
      <style>{`.legal h2{font-size:20px;margin:28px 0 6px}.legal p,.legal li{line-height:1.65}.legal ul{padding-left:20px;display:grid;gap:6px}`}</style>
    </main>
  );
}
