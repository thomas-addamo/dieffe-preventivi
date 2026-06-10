import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Percorsi raggiungibili senza sessione:
// - /login, /api/auth: autenticazione
// - /p, /api/public: pagina pubblica preventivo per i clienti (token-based)
// - /api/cron: job schedulati Vercel (protetti da CRON_SECRET nella route)
const PUBLIC_PATHS = ["/login", "/api/auth", "/p/", "/api/public", "/api/cron"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname === "/p" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (isPublic) return NextResponse.next();

  const token = request.cookies.get("dieffe_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
