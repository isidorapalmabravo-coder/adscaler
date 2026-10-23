import { applyPayment } from "@/lib/pagos";

export const dynamic = "force-dynamic";

// Mercado Pago avisa aquí cuando hay un pago. No se confía en el aviso: se consulta el pago directo a Mercado Pago.
async function handle(req: Request) {
  const url = new URL(req.url);
  let body: { type?: string; topic?: string; data?: { id?: string | number } } = {};
  try {
    body = await req.json();
  } catch {}
  const topic = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (topic !== "payment" || !id) return new Response("ok");
  try {
    await applyPayment(String(id));
  } catch {
    return new Response("reintentar", { status: 500 }); // Mercado Pago vuelve a avisar
  }
  return new Response("ok");
}
export const POST = handle;
export const GET = handle;
