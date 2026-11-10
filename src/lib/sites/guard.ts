import "server-only";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { sites } from "@/lib/db/schema";
import { can } from "@/lib/permissions/check";
import type { UserRole } from "@/lib/permissions/types";
import { sitesApiEnabledFor, SITES_MAINTENANCE_MESSAGE } from "@/lib/features";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Utente autenticato (e, se `manage`, autorizzato a modificare i cantieri). */
export async function requireSitesUser(manage = false): Promise<{ session: Session } | { error: NextResponse }> {
  const session = await getCurrentUser();
  if (!session) return { error: NextResponse.json({ error: "Non autorizzato" }, { status: 401 }) };
  if (!sitesApiEnabledFor(session.user.role)) {
    return { error: NextResponse.json({ error: SITES_MAINTENANCE_MESSAGE, maintenance: true }, { status: 503 }) };
  }
  if (manage && !can.manageSites(session.user.role as UserRole)) {
    return { error: NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 }) };
  }
  return { session };
}

/**
 * Come sopra, verificando anche che il cantiere esista. Con `manage` il
 * cantiere deve essere in corso: quelli in archivio si consultano soltanto
 * (si riaprono con POST /api/sites/:id/reopen).
 */
export async function requireSite(id: string, manage = false, opts: { allowArchived?: boolean } = {}) {
  const auth = await requireSitesUser(manage);
  if ("error" in auth) return auth;
  const [site] = await db.select({ id: sites.id, archivedAt: sites.archivedAt }).from(sites).where(eq(sites.id, id)).limit(1);
  if (!site) return { error: NextResponse.json({ error: "Cantiere non trovato" }, { status: 404 }) };
  if (manage && site.archivedAt && !opts.allowArchived) {
    return {
      error: NextResponse.json({ error: "Il cantiere è in archivio: riaprilo per modificarlo", archived: true }, { status: 409 }),
    };
  }
  return auth;
}
