import { currentUser } from "@/lib/auth";
import fs from "fs";
import { filePath, isSafeName, mimeOf } from "@/lib/files";

// Sirve archivos con soporte de rangos (los videos lo necesitan para reproducirse y adelantarse, sobre todo en Safari).
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!(await currentUser())) return new Response("Inicia sesión para continuar.", { status: 401 });
  const { name } = await params;
  if (!isSafeName(name)) return new Response("No encontrado", { status: 404 });
  try {
    const fp = filePath(name);
    const size = fs.statSync(fp).size;
    const type = mimeOf(name);
    const headers: Record<string, string> = {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=31536000, immutable",
    };
    const range = req.headers.get("range");
    const m = range?.match(/bytes=(\d*)-(\d*)/);
    if (m && (m[1] || m[2])) {
      let start = m[1] ? parseInt(m[1], 10) : size - parseInt(m[2], 10);
      let end = m[1] && m[2] ? parseInt(m[2], 10) : size - 1;
      start = Math.max(0, start);
      end = Math.min(size - 1, end);
      if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      const buf = Buffer.alloc(end - start + 1);
      const fd = fs.openSync(fp, "r");
      fs.readSync(fd, buf, 0, buf.length, start);
      fs.closeSync(fd);
      return new Response(new Uint8Array(buf), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(buf.length) },
      });
    }
    const buf = fs.readFileSync(fp);
    return new Response(new Uint8Array(buf), { headers: { ...headers, "Content-Length": String(size) } });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
