import fs from "fs";
import path from "path";
import OpenAI, { toFile } from "openai";
import { filePath, mimeOf, saveBuffer } from "./files";
import { logImage } from "./db";
import { assertQuota } from "./auth";
import { mockImageSvg } from "./mock";
import { withAnatomy, withRealism } from "./anatomy";

/**
 * MOTOR DE IMÁGENES: GPT Image en calidad BAJA por defecto.
 * En las pruebas (producto real + personaje como referencia) la calidad baja
 * mantuvo la misma persona y el mismo producto por ~US$0,03 la toma.
 * Calidad media (~3 veces más cara) queda como botón de "mayor calidad".
 */
export type Quality = "low" | "medium" | "high";

const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const DEFAULT_QUALITY = (process.env.OPENAI_IMAGE_QUALITY || "low") as Quality;
const USABLE_REF = new Set([".png", ".jpg", ".jpeg", ".webp"]);

// Las referencias se achican antes de enviarlas: las imágenes de entrada se cobran por tamaño.
const PRODUCT_REF_PX = Number(process.env.REF_MAX_PX_PRODUCT || 768);
const PERSONA_REF_PX = Number(process.env.REF_MAX_PX_PERSONA || 1024);

// Cuántos créditos de tu plan gasta cada calidad (1 crédito = 1 imagen en calidad baja)
export const CREDITS: Record<Quality, number> = { low: 1, medium: 3, high: 9 };

export function hasOpenAI() {
  return !!process.env.OPENAI_API_KEY;
}

export type RefKind = "persona" | "product";
export interface Ref {
  file: string; // nombre en data/uploads
  kind: RefKind;
}

// Achica la referencia con sharp. Si sharp no está disponible, usa el archivo tal cual.
async function prepare(ref: Ref): Promise<{ buf: Buffer; name: string; type: string }> {
  const original = fs.readFileSync(filePath(ref.file));
  const max = ref.kind === "persona" ? PERSONA_REF_PX : PRODUCT_REF_PX;
  try {
    const sharp = (await import("sharp")).default;
    const img = sharp(original, { failOn: "none" }).rotate();
    const meta = await img.metadata();
    if (Math.max(meta.width ?? 0, meta.height ?? 0) <= max) {
      return { buf: original, name: ref.file, type: mimeOf(ref.file) };
    }
    const buf = await img.resize({ width: max, height: max, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    return { buf, name: `${path.parse(ref.file).name}.png`, type: "image/png" };
  } catch {
    return { buf: original, name: ref.file, type: mimeOf(ref.file) };
  }
}

/**
 * Genera una imagen vertical (1024x1536) y la guarda en data/uploads.
 * refs = personaje aprobado (si lo hay) + foto(s) real(es) del producto.
 * Con referencias usa "edit" para mantener la misma cara y el mismo producto.
 */
export async function generateImage(
  prompt: string,
  refs: Ref[] = [],
  opts: { quality?: Quality; userId?: string } = {}
): Promise<string> {
  const quality = opts.quality ?? DEFAULT_QUALITY;
  prompt = withRealism(withAnatomy(prompt));
  assertQuota(opts.userId, CREDITS[quality]);
  logImage(CREDITS[quality], opts.userId);
  if (!hasOpenAI()) {
    return saveBuffer(Buffer.from(mockImageSvg(prompt)), "svg");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const usable = refs.filter((r) => USABLE_REF.has(path.extname(r.file).toLowerCase())).slice(0, 6);

  const res = usable.length
    ? await openai.images.edit({
        model: MODEL,
        image: await Promise.all(
          usable.map(async (r) => {
            const p = await prepare(r);
            return toFile(p.buf, p.name, { type: p.type });
          })
        ),
        prompt,
        size: "1024x1536",
        quality,
      })
    : await openai.images.generate({
        model: MODEL,
        prompt,
        size: "1024x1536",
        quality,
        n: 1,
      });

  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI no devolvió imagen");
  return saveBuffer(Buffer.from(b64, "base64"), "png");
}

// Ejecuta tareas con un máximo de N en paralelo
export async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}
