import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sites, quotes, auditLog } from "@/lib/db/schema";
import { deleteCloudinaryFolder } from "@/lib/cloudinary";
import { generateId } from "@/lib/utils";
import { getSiteDetail } from "./queries";

// ─────────────────────────────────────────────────────────────────────────────
// Fine vita di un cantiere.
//  • Concludi lavori → il cantiere va in ARCHIVIO con tutto ciò che contiene
//    (fasi, SAL, calendario, diario, foto): si consulta e si può riaprire.
//    I preventivi vengono segnati "lavori conclusi", così non generano un
//    nuovo cantiere. Nel registro attività resta un riepilogo.
//  • Riapri → torna in corso com'era.
//  • Elimina definitivamente (solo admin, solo dall'archivio) → via tutto,
//    anche le foto su Cloudinary. I preventivi restano.
// ─────────────────────────────────────────────────────────────────────────────

export const sitePhotoFolder = (siteId: string) => `dieffe-preventivi/cantieri/${siteId}`;

export async function completeSite(siteId: string, userId: string | null) {
  const detail = await getSiteDetail(siteId);
  if (!detail || detail.site.archivedAt) return false;
  const { site, metrics, quotes: siteQuotes, phases } = detail;
  const now = new Date();

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
        fineEffettiva: now.toISOString().slice(0, 10),
        avanzamento: Math.round(metrics.progress),
        fasi: phases.length,
        imponibile: Math.round(metrics.contractNet),
        fatturato: Math.round(metrics.invoiced),
        incassato: Math.round(metrics.paid),
        giorniRitardo: metrics.delayDays,
        automatico: userId == null,
      },
    }),
    db.update(quotes).set({ worksCompletedAt: now }).where(eq(quotes.siteId, siteId)),
    db
      .update(sites)
      .set({ archivedAt: now, archiveReason: "completed", updatedAt: now })
      .where(and(eq(sites.id, siteId), isNull(sites.archivedAt))),
  ]);
  return true;
}

/**
 * Riporta in corso un cantiere archiviato. Se era stato archiviato perché il
 * preventivo è tornato indietro, si riapre da solo quando il preventivo torna
 * inviato/accettato: a mano si riaprono i cantieri conclusi.
 */
export async function reopenSite(siteId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await db
    .select({ reason: sites.archiveReason, archivedAt: sites.archivedAt, name: sites.name, mainQuoteId: sites.mainQuoteId })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);
  if (!row) return { ok: false, error: "Cantiere non trovato" };
  if (!row.archivedAt) return { ok: true };
  if (row.reason === "withdrawn") {
    return { ok: false, error: "Il preventivo non è più inviato o accettato: il cantiere si riapre da solo quando lo diventa di nuovo." };
  }
  await db.batch([
    db.update(quotes).set({ worksCompletedAt: null }).where(eq(quotes.siteId, siteId)),
    db.update(sites).set({ archivedAt: null, archiveReason: null, updatedAt: new Date() }).where(eq(sites.id, siteId)),
    db.insert(auditLog).values({
      id: generateId(),
      userId,
      action: "site_reopened",
      entityType: "quote",
      entityId: row.mainQuoteId,
      changes: { cantiere: row.name },
    }),
  ]);
  return { ok: true };
}

/** Eliminazione definitiva (admin): solo per i cantieri in archivio. */
export async function purgeSite(siteId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await db
    .select({ archivedAt: sites.archivedAt, name: sites.name, mainQuoteId: sites.mainQuoteId })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);
  if (!row) return { ok: false, error: "Cantiere non trovato" };
  if (!row.archivedAt) return { ok: false, error: "Si possono eliminare solo i cantieri in archivio" };
  await db.batch([
    db.insert(auditLog).values({
      id: generateId(),
      userId,
      action: "site_deleted",
      entityType: "quote",
      entityId: row.mainQuoteId,
      changes: { cantiere: row.name },
    }),
    // I preventivi restano "lavori conclusi" (niente nuovo cantiere) e perdono
    // il collegamento; fasi, SAL, eventi, note e foto vanno via in cascata.
    db.update(quotes).set({ siteSetupAt: null, worksCompletedAt: sql`coalesce(${quotes.worksCompletedAt}, now())` }).where(eq(quotes.siteId, siteId)),
    db.delete(sites).where(eq(sites.id, siteId)),
  ]);
  await deleteCloudinaryFolder(sitePhotoFolder(siteId)).catch(() => {});
  return { ok: true };
}

/**
 * Chiusura automatica (cron): cantieri con TUTTE le fasi completate da
 * almeno 7 giorni e TUTTI i SAL fatturati vanno in archivio come conclusi.
 * Se qualcosa non è fatturato il cantiere resta aperto: è un promemoria.
 */
export async function autoCompleteSites(): Promise<number> {
  const rows = (
    await db.execute<{ id: string }>(sql`
      select s.id from sites s
      where s.status = 'active' and s.archived_at is null
        and exists (select 1 from site_phases p where p.site_id = s.id)
        and not exists (select 1 from site_phases p where p.site_id = s.id and p.done_at is null)
        and (select max(done_at) from site_phases p where p.site_id = s.id) < now() - interval '7 days'
        and not exists (select 1 from site_milestones m where m.site_id = s.id and m.invoiced_at is null)`)
  ).rows;
  for (const r of rows) await completeSite(r.id, null);
  return rows.length;
}

/**
 * Prima di eliminare DEFINITIVAMENTE un preventivo: il suo cantiere sparisce in
 * cascata dal database, le foto su Cloudinary vanno tolte a mano.
 */
export async function deleteSitePhotosOfQuote(quoteId: string) {
  const rows = await db.select({ id: sites.id }).from(sites).where(eq(sites.mainQuoteId, quoteId));
  for (const r of rows) await deleteCloudinaryFolder(sitePhotoFolder(r.id)).catch(() => {});
}
