import { and, asc, count, desc, eq, gte, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { clients, quotes, siteMilestones, sites } from "@/lib/db/schema";
import { getQuoteNetTotals } from "@/lib/db/quote-totals";
import { milestoneAmount } from "@/lib/sites/metrics";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard (C1): cosa conta adesso, per tutta l'impresa. Solo letture, su
// tabelle piccole: niente cache né tabelle nuove. L'elenco dei preventivi non
// sta qui ma nella pagina Preventivi.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;

export type PendingItem = {
  kind: "expired" | "followup" | "sal" | "unlock";
  id: string;
  /** Pagina da aprire. */
  href: string;
  title: string;
  subtitle: string;
  /** Etichetta breve (es. "Scaduto il 30/10"). */
  badge: string;
  /** Azione suggerita (es. "Richiama"). */
  action: string;
};

export type DashboardData = {
  todo: { expired: number; followup: number; salToInvoice: number; salAmount: number; unlockRequests: number | null };
  kpi: {
    pending: number;
    pendingOld: number;
    acceptedThisMonth: number;
    acceptedLastMonth: number;
    sitesActive: number;
    sitesPending: number;
    drafts: number;
  };
  pending: PendingItem[];
  sites: { id: string; name: string; progress: number }[];
  showSites: boolean;
};

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", timeZone: "Europe/Rome" }).format(new Date(iso));
const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY));

/** Inizio del mese (ore 0 a Roma, approssimato all'UTC) spostato di `delta` mesi. */
function monthStart(delta = 0) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + delta, 1)).toISOString();
}

export async function getDashboardData(opts: { isAdmin: boolean; showSites: boolean }): Promise<DashboardData> {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const ninetyAgo = new Date(Date.now() - 90 * DAY).toISOString();
  const alive = isNull(quotes.deletedAt);
  const sent = and(alive, eq(quotes.status, "sent"));
  const base = { id: quotes.id, code: quotes.code, title: quotes.title, clientName: clients.name };

  const [
    expired,
    followup,
    [{ value: pending }],
    [{ value: pendingOld }],
    [{ value: acceptedThisMonth }],
    [{ value: acceptedLastMonth }],
    [{ value: drafts }],
    unlock,
  ] = await Promise.all([
    db.select({ ...base, validUntil: quotes.validUntil }).from(quotes).leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(and(sent, isNotNull(quotes.validUntil), lt(quotes.validUntil, today)))
      .orderBy(desc(quotes.validUntil)),
    // Inviati da più di 7 giorni e non ancora scaduti: da sollecitare.
    db.select({ ...base, sentAt: quotes.sentAt, updatedAt: quotes.updatedAt, validUntil: quotes.validUntil }).from(quotes)
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(and(sent, lt(quotes.sentAt, weekAgo)))
      .orderBy(asc(quotes.sentAt)),
    db.select({ value: count() }).from(quotes).where(sent),
    db.select({ value: count() }).from(quotes).where(and(sent, lt(quotes.sentAt, ninetyAgo))),
    db.select({ value: count() }).from(quotes).where(and(alive, eq(quotes.status, "accepted"), gte(quotes.acceptedAt, monthStart(0)))),
    db.select({ value: count() }).from(quotes)
      .where(and(alive, eq(quotes.status, "accepted"), gte(quotes.acceptedAt, monthStart(-1)), lt(quotes.acceptedAt, monthStart(0)))),
    db.select({ value: count() }).from(quotes).where(and(alive, eq(quotes.status, "draft"))),
    opts.isAdmin
      ? db.select({ ...base, requestedAt: quotes.unlockRequestedAt }).from(quotes).leftJoin(clients, eq(quotes.clientId, clients.id))
          .where(and(alive, isNotNull(quotes.unlockRequestedAt))).orderBy(desc(quotes.unlockRequestedAt))
      : Promise.resolve([]),
  ]);

  const expiredIds = new Set(expired.map((q) => q.id));
  const toFollow = followup.filter((q) => !expiredIds.has(q.id));

  // SAL raggiunti e non fatturati, con l'importo calcolato come nella scheda cantiere.
  let salRows: { id: string; label: string; percent: number | null; amount: number | null; quoteId: string | null; siteId: string; siteName: string; code: string | null }[] = [];
  let siteRows: { id: string; name: string; status: string; progress: number | null }[] = [];
  let salAmount = 0;
  if (opts.showSites) {
    [salRows, siteRows] = await Promise.all([
      db.select({
        id: siteMilestones.id, label: siteMilestones.label, percent: siteMilestones.percent, amount: siteMilestones.amount,
        quoteId: siteMilestones.quoteId, siteId: sites.id, siteName: sites.name, code: quotes.code,
      }).from(siteMilestones)
        .innerJoin(sites, eq(sites.id, siteMilestones.siteId))
        .leftJoin(quotes, eq(quotes.id, siteMilestones.quoteId))
        .where(and(isNotNull(siteMilestones.reachedAt), isNull(siteMilestones.invoicedAt), isNull(sites.archivedAt)))
        .orderBy(desc(siteMilestones.reachedAt)),
      db.select({ id: sites.id, name: sites.name, status: sites.status, progress: sites.progress }).from(sites)
        .where(isNull(sites.archivedAt)).orderBy(desc(sites.progress)),
    ]);
    if (salRows.length) {
      const net = await getQuoteNetTotals();
      salAmount = salRows.reduce((sum, m) => sum + milestoneAmount(m, net, 0), 0);
    }
  }

  const items: PendingItem[] = [
    ...unlock.map((q) => ({
      kind: "unlock" as const, id: q.id, href: `/preventivi/${q.id}`, title: q.title.trim(),
      subtitle: [q.code, q.clientName].filter(Boolean).join(" · "), badge: "Chiede lo sblocco", action: "Rispondi",
    })),
    ...expired.map((q) => ({
      kind: "expired" as const, id: q.id, href: `/preventivi/${q.id}`, title: q.title.trim(),
      subtitle: [q.code, q.clientName].filter(Boolean).join(" · "), badge: `Scaduto il ${shortDate(q.validUntil!)}`, action: "Richiama",
    })),
    ...toFollow.map((q) => ({
      kind: "followup" as const, id: q.id, href: `/preventivi/${q.id}`, title: q.title.trim(),
      subtitle: [q.code, q.clientName].filter(Boolean).join(" · "), badge: `Inviato ${daysAgo(q.sentAt ?? q.updatedAt)} gg fa`, action: "Sollecita",
    })),
    ...salRows.map((m) => ({
      kind: "sal" as const, id: m.id, href: `/cantieri/${m.siteId}?tab=sal`, title: m.label,
      subtitle: [m.code, m.siteName.trim()].filter(Boolean).join(" · "),
      badge: m.percent != null ? `SAL ${m.percent}% raggiunto` : "SAL raggiunto", action: "Fattura",
    })),
  ];

  // Lista breve e varia: al massimo 3 per tipo, 7 in tutto.
  const perKind = new Map<string, number>();
  const pendingList = items.filter((i) => {
    const n = perKind.get(i.kind) ?? 0;
    perKind.set(i.kind, n + 1);
    return n < 3;
  }).slice(0, 7);

  return {
    todo: {
      expired: expired.length,
      followup: toFollow.length,
      salToInvoice: salRows.length,
      salAmount,
      unlockRequests: opts.isAdmin ? unlock.length : null,
    },
    kpi: {
      pending,
      pendingOld,
      acceptedThisMonth,
      acceptedLastMonth,
      sitesActive: siteRows.filter((s) => s.status === "active").length,
      sitesPending: siteRows.filter((s) => s.status !== "active").length,
      drafts,
    },
    pending: pendingList,
    sites: siteRows
      .filter((s) => s.status === "active")
      .slice(0, 5)
      .map((s) => ({ id: s.id, name: s.name.trim(), progress: Math.round(s.progress ?? 0) })),
    showSites: opts.showSites,
  };
}
