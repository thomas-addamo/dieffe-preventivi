import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sites, quotes, auditLog } from "@/lib/db/schema";
import { deleteCloudinaryFolder } from "@/lib/cloudinary";
import { generateId } from "@/lib/utils";
import { getSiteDetail } from "./queries";

/**
 * Lavori conclusi: il cantiere viene ELIMINATO con tutto ciò che contiene
 * (fasi, SAL, eventi, note — ON DELETE CASCADE — ed eventuali file su
 * Cloudinary). I preventivi restano: vengono solo segnati "lavori conclusi",
 * così non generano di nuovo un cantiere. Nel registro attività resta un
 * riepilogo di poche righe (importi, date) per memoria.
 */
export async function completeSite(siteId: string, userId: string | null) {
  const detail = await getSiteDetail(siteId);
  if (!detail) return false;
  const { site, metrics, quotes: siteQuotes, phases } = detail;

  await db.batch([
    db.insert(auditLog).values({
      id: generateId(),
      userId,
      action: "site_completed",
      entityType: "quote",
      entityId: site.mainQuoteId,
      changes: {
        cantiere: site.name,
        indirizzo: site.address,
        preventivi: siteQuotes.map((q) => q.code),
        inizio: site.startDate,
        finePrevista: site.plannedEndDate,
        fineEffettiva: new Date().toISOString().slice(0, 10),
        avanzamento: Math.round(metrics.progress),
        fasi: phases.length,
        imponibile: Math.round(metrics.contractNet),
        fatturato: Math.round(metrics.invoiced),
        incassato: Math.round(metrics.paid),
        giorniRitardo: metrics.delayDays,
        automatico: userId == null,
      },
    }),
    db
      .update(quotes)
      .set({ worksCompletedAt: new Date(), siteSetupAt: null })
      .where(eq(quotes.siteId, siteId)),
    db.delete(sites).where(eq(sites.id, siteId)),
  ]);

  // File del cantiere (foto future): best-effort, non blocca.
  await deleteCloudinaryFolder(`dieffe-preventivi/cantieri/${siteId}`).catch(() => {});
  return true;
}

/**
 * Chiusura automatica (cron): cantieri con TUTTE le fasi completate da
 * almeno 7 giorni e TUTTI i SAL fatturati. Se qualcosa non è fatturato il
 * cantiere resta aperto: chiuderlo farebbe perdere il promemoria.
 */
export async function autoCompleteSites(): Promise<number> {
  const rows = (
    await db.execute<{ id: string }>(sql`
      select s.id from sites s
      where s.status = 'active'
        and exists (select 1 from site_phases p where p.site_id = s.id)
        and not exists (select 1 from site_phases p where p.site_id = s.id and p.done_at is null)
        and (select max(done_at) from site_phases p where p.site_id = s.id) < now() - interval '7 days'
        and not exists (select 1 from site_milestones m where m.site_id = s.id and m.invoiced_at is null)`)
  ).rows;
  for (const r of rows) await completeSite(r.id, null);
  return rows.length;
}
