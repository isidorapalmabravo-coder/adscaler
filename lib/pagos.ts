import { PLANES, PACKS, PRUEBA, findCode, codeExpired, priceWithCode, IMAGENES_POR_VIDEO } from "./plans";
import { mutate, read } from "./db";
import type { User } from "./types";

/** Pagos con Mercado Pago (Checkout Pro). Se activa al poner MP_ACCESS_TOKEN en las variables del servidor. */
export const pagosListos = () => !!process.env.MP_ACCESS_TOKEN;

export type Kind = "plan" | "pack" | "prueba";

/** El precio SIEMPRE se calcula aquí en el servidor; lo que mande el navegador no cuenta. */
export function resolveItem(user: User, kind: Kind, id: string, codeText?: string): { title: string; amount: number; ref: string } {
  if (kind === "plan") {
    const plan = PLANES.find((p) => p.id === id);
    if (!plan) throw new Error("Ese plan no existe.");
    let code = null;
    if (codeText?.trim()) {
      code = findCode(codeText);
      if (!code || codeExpired(code)) throw new Error("Ese código no es válido o ya venció.");
    }
    const amount = priceWithCode(plan, code);
    return { title: `Adscaler · Plan ${plan.nombre} (1 mes)`, amount, ref: `${user.id}|plan|${plan.id}` };
  }
  if (kind === "pack") {
    const pack = PACKS.find((p) => p.id === id);
    if (!pack) throw new Error("Ese pack no existe.");
    return { title: `Adscaler · ${pack.videos} videos`, amount: pack.precio, ref: `${user.id}|pack|${pack.id}` };
  }
  if (user.trialUsed) throw new Error("Ya compraste tu video de prueba. Elige un plan o un pack.");
  return { title: "Adscaler · 1 video de prueba", amount: PRUEBA.precio, ref: `${user.id}|prueba|${PRUEBA.id}` };
}

export async function createCheckout(user: User, kind: Kind, id: string, codeText: string | undefined, base: string) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Los pagos aún no están activados. Estamos terminando de conectar Mercado Pago, vuelve en un rato.");
  const item = resolveItem(user, kind, id, codeText);
  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ id: `${kind}-${id}`, title: item.title, quantity: 1, unit_price: item.amount, currency_id: "CLP" }],
      payer: { email: user.email },
      external_reference: item.ref,
      notification_url: `${base}/api/pagos/webhook`,
      back_urls: { success: `${base}/planes?pago=ok`, failure: `${base}/planes?pago=error`, pending: `${base}/planes?pago=pendiente` },
      auto_return: "approved",
      statement_descriptor: "ADSCALER",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { init_point?: string; message?: string };
  if (!res.ok || !data.init_point) throw new Error("No se pudo abrir el pago. " + (data.message ?? ""));
  return data.init_point;
}

/** Revisa el pago directo con Mercado Pago (así nadie puede inventar un aviso) y, si está aprobado, sube el plan o las imágenes. */
export async function applyPayment(paymentId: string): Promise<"aplicado" | "ya-estaba" | "no-aprobado"> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Falta MP_ACCESS_TOKEN");
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status}`);
  const pay = (await res.json()) as { id: number; status: string; transaction_amount: number; external_reference?: string };
  if (pay.status !== "approved") return "no-aprobado";
  const [userId, kind, item] = String(pay.external_reference ?? "").split("|");
  if (!userId || !kind || !item) return "no-aprobado";
  const pid = String(pay.id);

  return mutate((db) => {
    db.pagos ??= [];
    if (db.pagos.some((p) => p.id === pid)) return "ya-estaba" as const;
    const u = db.users.find((x) => x.id === userId);
    if (!u) return "no-aprobado" as const;
    if (kind === "plan") {
      const plan = PLANES.find((p) => p.id === item);
      if (!plan) return "no-aprobado" as const;
      const from = u.planUntil && new Date(u.planUntil) > new Date() ? new Date(u.planUntil) : new Date();
      from.setDate(from.getDate() + 30);
      u.plan = plan.nombre;
      u.imageLimit = plan.imagenes;
      u.planUntil = from.toISOString();
    } else if (kind === "pack") {
      const pack = PACKS.find((p) => p.id === item);
      if (!pack) return "no-aprobado" as const;
      u.credits = (u.credits ?? 0) + pack.videos * IMAGENES_POR_VIDEO;
    } else if (kind === "prueba") {
      u.credits = (u.credits ?? 0) + PRUEBA.videos * IMAGENES_POR_VIDEO;
      u.trialUsed = true;
    } else return "no-aprobado" as const;
    db.pagos.push({ id: pid, userId, kind: kind as Kind, item, amount: pay.transaction_amount, at: new Date().toISOString() });
    return "aplicado" as const;
  });
}

export const pagosRecientes = () => read((db) => [...(db.pagos ?? [])].reverse().slice(0, 30));
