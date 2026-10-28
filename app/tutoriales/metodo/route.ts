import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Descarga del método en markdown (solo con sesión iniciada: lo protege la puerta de entrada de la app).
export async function GET() {
  try {
    const md = fs.readFileSync(path.join(process.cwd(), "content", "metodo-anuncios.md"), "utf8");
    return new Response(md, {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": 'attachment; filename="metodo-adscaler.md"' },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
