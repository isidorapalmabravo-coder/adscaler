import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, readToken } from "@/lib/auth";

// Puerta de entrada: sin sesión válida solo se puede ver /login y /registro.
const PUBLIC = ["/login", "/registro"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();
  if (readToken(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return Response.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|logo/|fonts/).*)"],
};
