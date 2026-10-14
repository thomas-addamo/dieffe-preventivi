import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quotes, sessions, userAccessLog, notifications } from "@/lib/db/schema";
import { lt, isNotNull, and, eq, sql } from "drizzle-orm";
import { deleteCloudinaryFolder } from "@/lib/cloudinary";
import { moveLegacySignatures } from "@/lib/signatures";
import { runSitesMaintenance } from "@/lib/sites/maintenance";

export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const expiredQuotes = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(
      and(
        isNotNull(quotes.deletedAt),
        lt(quotes.deletedAt, thirtyDaysAgo)
      )
    );

  for (const quote of expiredQuotes) {
    await deleteCloudinaryFolder(`dieffe-preventivi/${quote.id}`).catch(() => {});
    await db.delete(quotes).where(eq(quotes.id, quote.id));
  }

  // Manutenzione: dati che altrimenti crescerebbero senza limite.
  // Sessioni scadute (non più utilizzabili: getSessionUser le scarta già).
  const expiredSessions = await db
    .delete(sessions)
    .where(sql`${sessions.expiresAt} < now()`)
    .returning({ id: sessions.id });

  // Registro accessi: si tengono gli ultimi 12 mesi.
  const oldAccessLogs = await db
    .delete(userAccessLog)
    .where(sql`${userAccessLog.loginAt} < now() - interval '12 months'`)
    .returning({ id: userAccessLog.id });

  // Notifiche già lette da più di 90 giorni (le non lette restano sempre).
  const oldNotifications = await db
    .delete(notifications)
    .where(sql`${notifications.readAt} < now() - interval '90 days'`)
    .returning({ id: notifications.id });

  // Firme vecchie ancora in base64 nel DB → Cloudinary.
  const movedSignatures = await moveLegacySignatures().catch(() => 0);

  // Gestione cantieri: allineamento, SAL che scattano, promemoria del giorno
  // dopo, chiusura (= eliminazione) dei cantieri finiti e fatturati.
  const sitesReport = await runSitesMaintenance(Date.now() + 40_000).catch((err) => ({
    error: err instanceof Error ? err.message : String(err),
  }));

  return NextResponse.json({
    sites: sitesReport,
    deleted: expiredQuotes.length,
    expiredSessions: expiredSessions.length,
    accessLogs: oldAccessLogs.length,
    notifications: oldNotifications.length,
    movedSignatures,
  });
}
