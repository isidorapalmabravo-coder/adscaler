/** Precios de venta (IVA incluido). Se cambian aquí y se actualiza toda la web. */
export interface Plan {
  id: string;
  nombre: string;
  para: string;
  precio: number; // precio de lista al mes
  imagenes: number;
  videos: number;
  destacado?: boolean;
}

export interface Pack {
  id: string;
  videos: number;
  precio: number; // pago único
}

export const PLANES: Plan[] = [
  { id: "inicial", nombre: "Inicial", para: "Para partir con tus primeros productos", precio: 62990, imagenes: 450, videos: 20 },
  { id: "creador", nombre: "Creador", para: "Para varios productos y ángulos a la vez", precio: 94990, imagenes: 900, videos: 40, destacado: true },
  { id: "agencia", nombre: "Agencia", para: "Para producir videos de muchos clientes", precio: 109990, imagenes: 1350, videos: 60 },
];

// Venta por packs de videos (pago único, no es suscripción). Los códigos de descuento NO aplican aquí.
export const PACKS: Pack[] = [
  { id: "pack5", videos: 5, precio: 19990 },
  { id: "pack10", videos: 10, precio: 29990 },
];

export const IMAGENES_POR_VIDEO = 22;

/** Video de prueba: se ofrece a todos los que crean su cuenta, para que prueben la app por poco. Pago único. */
export const PRUEBA: Pack = { id: "prueba", videos: 1, precio: 1000 };

/** Descuento de lanzamiento en TODAS las suscripciones mensuales (no aplica a los packs de videos). */
export const PROMO_PERCENT = 15;

/** Precio con la promo: 15% menos, bajado al precio terminado en 990 más cercano hacia abajo. */
export function promoPrice(plan: Plan): number {
  const raw = plan.precio * (1 - PROMO_PERCENT / 100);
  return Math.floor((raw + 10) / 1000) * 1000 - 10;
}

/** Códigos de descuento: solo para suscripciones mensuales, y solo en los planes indicados. */
export interface DiscountCode {
  code: string;
  percent: number;
  plans: string[]; // ids de plan donde aplica
  redondeo: number; // el precio final se redondea al múltiplo más cercano
  nota: string;
  fijos?: Record<string, number>; // precio final exacto por plan (si está, manda sobre el porcentaje)
  vence?: string; // fecha límite (AAAA-MM-DD); si pasó, el código ya no sirve
}

// Sin código se cobra el precio de lista; al escribir un código los precios bajan. Agrega aquí los códigos que quieras entregar.
export const CODES: DiscountCode[] = [
  { code: "MENTORIA", percent: 15, plans: ["inicial", "creador", "agencia"], redondeo: 1000, fijos: { inicial: 49990 }, nota: "Precio especial de mentoría en tu suscripción" },
];

export const codeExpired = (c: DiscountCode) => !!c.vence && new Date(c.vence + "T23:59:59") < new Date();

export function findCode(input: string): DiscountCode | null {
  const c = input.trim().toUpperCase();
  return CODES.find((x) => x.code === c) ?? null;
}

/** Precio final de un plan con un código (si el código no aplica a ese plan, no cambia nada). */
export function priceWithCode(plan: Plan, code: DiscountCode | null): number {
  if (!code || !code.plans.includes(plan.id)) return plan.precio;
  if (code.fijos?.[plan.id] !== undefined) return code.fijos[plan.id];
  const raw = plan.precio * (1 - code.percent / 100);
  return Math.floor((raw + 10) / code.redondeo) * code.redondeo - 10;
}

export const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
