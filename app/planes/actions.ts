"use server";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { createCheckout, type Kind } from "@/lib/pagos";

export async function startCheckout(kind: Kind, id: string, code?: string): Promise<{ url?: string; error?: string }> {
  const me = await requireUser();
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const base = (process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, "");
    return { url: await createCheckout(me, kind, id, code, base) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo abrir el pago." };
  }
}
