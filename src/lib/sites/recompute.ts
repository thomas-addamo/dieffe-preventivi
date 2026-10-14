import "server-only";
import { eq, inArray, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sites, sitePhases, siteMilestones, quotes, users } from "@/lib/db/schema";
import { notifyUsers } from "@/lib/notifications";
import { formatCurrency } from "@/lib/utils";
import { computeProgress, milestoneAmount, toDay } from "./metrics";
import { getSiteQuotes } from "./queries";

/**
 * Ricalcola avanzamento e SAL raggiunti di un cantiere dopo ogni modifica.
 *  • avanzamento = importo delle fasi completate / importo totale;
 *  • un SAL è "raggiunto" quando scatta il suo momento (accettazione, inizio
 *    lavori, fine della sua fase, fine lavori). Se una fase viene riaperta
 *    il SAL torna indietro, ma solo finché non è stato fatturato.
 * I SAL appena raggiunti generano la notifica "da fatturare" (campanella +
 * push su tutti i dispositivi) al titolare del preventivo e agli admin.
 * Scrive solo ciò che cambia.
 */
export async function recomputeSite(siteId: string, opts: { notify?: boolean } = {}) {
  const [[site], phases, milestones] = await Promise.all([
    db.select().from(sites).where(eq(sites.id, siteId)).limit(1),
    db.select({ id: sitePhases.id, weight: sitePhases.weight, doneAt: sitePhases.doneAt }).from(sitePhases).where(eq(sitePhases.siteId, siteId)),
    db.select().from(siteMilestones).where(eq(siteMilestones.siteId, siteId)),
  ]);
  if (!site) return;

  const progress = Math.round(computeProgress(phases) * 10) / 10;
  const doneIds = new Set(phases.filter((p) => p.doneAt).map((p) => p.id));
  const allDone = phases.length > 0 && doneIds.size === phases.length;
  const started = !!site.startDate && toDay(site.startDate) <= toDay(new Date());

  const reachedNow: string[] = [];
  const unreached: string[] = [];
  for (const m of milestones) {
    if (m.trigger === "manual") continue;
    const reached =
      site.status === "active" &&
      (m.trigger === "accept" ||
        (m.trigger === "start" && started) ||
        (m.trigger === "phase" && !!m.phaseId && doneIds.has(m.phaseId)) ||
        (m.trigger === "end" && allDone));
    if (reached && !m.reachedAt) reachedNow.push(m.id);
    if (!reached && m.reachedAt && !m.invoicedAt) unreached.push(m.id);
  }

  const writes = [];
  if (Math.abs(site.progress - progress) > 0.05) {
    writes.push(db.update(sites).set({ progress, updatedAt: new Date() }).where(eq(sites.id, siteId)));
  }
  if (reachedNow.length) writes.push(db.update(siteMilestones).set({ reachedAt: new Date() }).where(inArray(siteMilestones.id, reachedNow)));
  if (unreached.length) writes.push(db.update(siteMilestones).set({ reachedAt: null }).where(inArray(siteMilestones.id, unreached)));
  if (writes.length) await db.batch(writes as [(typeof writes)[number], ...typeof writes]);

  if (opts.notify !== false && reachedNow.length) {
    const [owner] = await db.select({ userId: quotes.userId }).from(quotes).where(eq(quotes.id, site.mainQuoteId)).limit(1);
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.disabled, false)));
    const siteQuotes = await getSiteQuotes(siteId);
    const net = new Map(siteQuotes.map((q) => [q.id, q.net]));
    const main = siteQuotes.find((q) => q.id === site.mainQuoteId)?.net ?? 0;
    const items = milestones.filter((m) => reachedNow.includes(m.id));
    const total = items.reduce((s, m) => s + milestoneAmount(m, net, main), 0);
    await notifyUsers([owner?.userId ?? "", ...admins.map((r) => r.id)], {
      type: "site",
      title: `SAL da fatturare · ${site.name}`,
      body: `${items.map((m) => m.label).join(", ")}: ${formatCurrency(total)} + IVA`,
      link: `/cantieri/${siteId}?tab=sal`,
    });
  }
}
