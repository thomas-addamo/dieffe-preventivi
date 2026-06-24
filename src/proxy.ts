import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Percorsi raggiungibili senza sessione:
// - /login, /api/auth: autenticazione
// - /p, /api/public: pagina pubblica preventivo per i clienti (token-based)
// - /api/cron: job schedulati Vercel (protetti da CRON_SECRET nella route)
const PUBLIC_PATHS = ["/login", "/api/auth", "/p/", "/api/public", "/api/cron"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Root "/" : landing pubblica vs dashboard vs Electron ──────────────────
  // La root mostra la landing di presentazione SOLO a visitatori non loggati su
  // browser. In Electron la landing non va mai mostrata; chi è loggato salta
  // diretto in dashboard.
  if (pathname === "/") {
    const userAgent = request.headers.get("user-agent") ?? "";
    if (userAgent.includes("Electron")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const rootToken = request.cookies.get("dieffe_session")?.value;
    if (rootToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    // Nessuna sessione, browser normale → mostra la landing (page.tsx).
    return NextResponse.next();
  }

  // Asset statici / metadata pubblici (icone, manifest, favicon, ecc.): devono
  // essere raggiungibili SENZA sessione, altrimenti iOS/Safari riceve un 307
  // verso /login mentre prova a scaricare apple-icon/manifest in "Aggiungi a
  // Home" e l'icona della web app non si carica. Tutto ciò che ha un'estensione
  // di file (e non è una rotta API) è un asset pubblico.
  const isStaticAsset = !pathname.startsWith("/api") && /\.[a-z0-9]+$/i.test(pathname);
  const isPublic =
    isStaticAsset ||
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
