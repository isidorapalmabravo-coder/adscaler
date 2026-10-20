import path from "path";

// Convierte el brief subido a texto que Gemini pueda leer.
// Los .docx se pasan a HTML para conservar las tablas (AUDIO / VISUAL / PROMPT).
export async function briefToText(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.convertToHtml({ buffer: buf });
    return value
      .replace(/<img[^>]*>/g, "")
      .replace(/<(\/?)(strong|em|a)[^>]*>/g, "")
      .replace(/\s+/g, " ");
  }
  return buf.toString("utf8");
}
