import "server-only";
import { sql, eq, asc, desc, and, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  sites,
  clients,
  sitePhases,
  siteMilestones,
  siteEvents,
  siteNotes,
  sitePhotos,
  users,
  type Site,
  type SitePhase,
  type SiteMilestone,
  type SiteEvent,
  type SitePhoto,
} from "@/lib/db/schema";
import { computeSiteMetrics, isoDay, milestoneAmount, toDay, type SiteMetrics } from "./metrics";

// ─────────────────────────────────────────────────────────────────────────────
// Letture dei cantieri. Gli importi non sono copiati nel cantiere: si
// calcolano in UNA query aggregata dai preventivi collegati (come i totali
// della dashboard), così restano sempre allineati alle modifiche.
// ─────────────────────────────────────────────────────────────────────────────

export type SiteQuote = {
  id: string;
  code: string;
  title: string;
  status: string;
  kind: string;
  siteId: string;
  userId: string;
  vatRate: number;
  paymentTerms: string | null;
  setupDone: boolean;
  net: number;
};

/**
 * Preventivi collegati a un cantiere (`siteId`) o a tutti quelli in corso /
 * in archivio, con l'imponibile netto. Nell'archivio si vedono anche i
 * preventivi cestinati (spesso il motivo per cui il cantiere è lì).
 */
export async function getSiteQuotes(siteId?: string, archived = false): Promise<SiteQuote[]> {
  const scope = siteId
    ? sql`site_id = ${siteId}`
    : sql`site_id in (select id from sites where archived_at is ${archived ? sql`not null` : sql`null`})`;
  const res = await db.execute<{
    id: string; code: string; title: string; status: string; kind: string; site_id: string;
    user_id: string; vat_rate: number; payment_terms: string | null; setup_done: boolean;
    gross: string | number | null; discount_type: string | null; discount_value: number | null;
  }>(sql`
    with sq as (select id from quotes where ${scope} ${archived && !siteId ? sql`` : sql`and deleted_at is null`})
    select q.id, q.code, q.title, q.status, q.kind, q.site_id, q.user_id, q.vat_rate, q.payment_terms,
           q.site_setup_at is not null as setup_done,
           coalesce(g.gross, 0) as gross, q.discount_type, q.discount_value
    from quotes q
    left join (
      -- Totali solo delle sezioni dei preventivi richiesti (non di tutto il DB).
      select s.quote_id,
             sum(case when s.lump_sum then coalesce(s.lump_sum_price, 0) else coalesce(i.total, 0) end) as gross
      from quote_sections s
      left join lateral (select sum(total) as total from quote_items where section_id = s.id) i on true
      where s.quote_id in (select id from sq)
        and not (s.is_optional and not s.is_optional_included)
      group by s.quote_id
    ) g on g.quote_id = q.id
    where q.id in (select id from sq)
    order by q.kind desc, q.created_at`);

  return res.rows.map((r) => {
    const gross = Number(r.gross) || 0;
    const discount =
      r.discount_type === "percent" && r.discount_value
        ? gross * (r.discount_value / 100)
        : r.discount_type === "fixed" && r.discount_value
          ? r.discount_value
          : 0;
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      status: r.status,
      kind: r.kind,
      siteId: r.site_id,
      userId: r.user_id,
      vatRate: Number(r.vat_rate) || 0,
      paymentTerms: r.payment_terms,
      setupDone: !!r.setup_done,
      net: Math.max(0, gross - discount),
    };
  });
}

/** I preventivi del cantiere con il principale per primo. */
function orderQuotes(list: SiteQuote[], mainQuoteId: string) {
  return [...list].sort((a, b) => (a.id === mainQuoteId ? -1 : b.id === mainQuoteId ? 1 : 0));
}

export type SiteListItem = {
  id: string;
  name: string;
  status: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  geoStatus: string;
  clientName: string | null;
  clientPhone: string | null;
  mainQuoteId: string;
  startDate: string | null;
  plannedEndDate: string | null;
  /** In archivio da quando (ISO) e perché: solo nell'elenco dell'archivio. */
  archivedAt: string | null;
  archiveReason: "completed" | "withdrawn" | null;
  quotes: { id: string; code: string; title: string; status: string; kind: string; net: number }[];
  metrics: SiteMetrics;
  nextEvent: { date: string; title: string; type: string } | null;
  topTip: { title: string; body: string; priority: string } | null;
};

export type SitesOverview = {
  sites: SiteListItem[];
  upcoming: { siteId: string; siteName: string; date: string; endDate: string | null; title: string; type: string }[];
  totals: {
    active: number;
    pending: number;
    /** Cantieri in archivio (si consultano da GET /api/sites/archive). */
    archived: number;
    inProgressValue: number;
    invoiced: number;
    milestonesTotal: number;
    toInvoice: number;
    toCollect: number;
    late: number;
    delayCost: number;
  };
  /** Lavoro in sospeso (indirizzi da cercare, fasi da generare). */
  pendingWork: number;
};

/** Cantieri in corso (null) o in archivio (not null), come filtro SQL su `sites`. */
const inArchive = (archived: boolean) => (archived ? isNotNull(sites.archivedAt) : isNull(sites.archivedAt));
/** Sottoquery degli id dei cantieri in corso / in archivio. */
const siteIdsWhere = (archived: boolean) =>
  sql`(select id from sites where archived_at is ${archived ? sql`not null` : sql`null`})`;

/**
 * Elenco dei cantieri con le metriche. Per non caricare tutto il database a
 * ogni apertura, SAL e fasi si leggono solo per i cantieri richiesti (in corso
 * oppure in archivio) e solo con le colonne che servono ai calcoli.
 */
async function loadSiteList(archived: boolean, upcomingEvents: SitesOverview["upcoming"] = []): Promise<SiteListItem[]> {
  const [siteRows, quoteRows, milestoneRows, phaseRows] = await Promise.all([
    db
      .select({ site: sites, clientName: clients.name, clientPhone: clients.phone })
      .from(sites)
      .leftJoin(clients, eq(sites.clientId, clients.id))
      .where(inArchive(archived))
      .orderBy(archived ? desc(sites.archivedAt) : asc(sites.name)),
    getSiteQuotes(undefined, archived),
    db
      .select({
        siteId: siteMilestones.siteId,
        quoteId: siteMilestones.quoteId,
        percent: siteMilestones.percent,
        amount: siteMilestones.amount,
        reachedAt: siteMilestones.reachedAt,
        invoicedAt: siteMilestones.invoicedAt,
        paidAt: siteMilestones.paidAt,
      })
      .from(siteMilestones)
      .where(sql`${siteMilestones.siteId} in ${siteIdsWhere(archived)}`),
    // Solo i campi del programma: servono per l'avanzamento atteso e il ritardo.
    db
      .select({ siteId: sitePhases.siteId, weight: sitePhases.weight, plannedStart: sitePhases.plannedStart, plannedEnd: sitePhases.plannedEnd })
      .from(sitePhases)
      .where(sql`${sitePhases.siteId} in ${siteIdsWhere(archived)}`),
  ]);

  const quotesBySite = groupBy(quoteRows, (q) => q.siteId);
  const msBySite = groupBy(milestoneRows, (m) => m.siteId);
  const phBySite = groupBy(phaseRows, (p) => p.siteId);
  const nextBySite = new Map<string, SitesOverview["upcoming"][number]>();
  for (const e of upcomingEvents) if (!nextBySite.has(e.siteId)) nextBySite.set(e.siteId, e);

  return siteRows.map(({ site, clientName, clientPhone }) => {
    const q = orderQuotes(quotesBySite.get(site.id) ?? [], site.mainQuoteId);
    const metrics = computeSiteMetrics({ site, quotes: q, milestones: msBySite.get(site.id) ?? [], phases: phBySite.get(site.id) ?? [] });
    const ev = nextBySite.get(site.id);
    const tips = (site.aiInsights as { tips?: { title: string; body: string; priority: string }[] } | null)?.tips;
    return {
      id: site.id,
      name: site.name,
      status: site.status,
      address: site.address,
      lat: site.lat,
      lng: site.lng,
      geoStatus: site.geoStatus,
      clientName,
      clientPhone,
      mainQuoteId: site.mainQuoteId,
      startDate: site.startDate,
      plannedEndDate: site.plannedEndDate,
      archivedAt: site.archivedAt ? site.archivedAt.toISOString() : null,
      archiveReason: site.archiveReason,
      quotes: q.map(({ id, code, title, status, kind, net }) => ({ id, code, title, status, kind, net })),
      metrics,
      nextEvent: ev ? { date: ev.date, title: ev.title, type: ev.type } : null,
      topTip: archived ? null : (tips?.find((t) => t.priority === "alta") ?? tips?.[0] ?? null),
    };
  });
}

function groupBy<T>(rows: T[], key: (r: T) => string) {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

export async function getSitesOverview(): Promise<SitesOverview> {
  const today = toDay(new Date());
  const in7 = isoDay(today + 7);
  const todayIso = isoDay(today);

  const [eventRows, pendingSetup, archivedCount] = await Promise.all([
    db
      .select({
        siteId: siteEvents.siteId,
        siteName: sites.name,
        date: siteEvents.date,
        endDate: siteEvents.endDate,
        title: siteEvents.title,
        type: siteEvents.type,
      })
      .from(siteEvents)
      .innerJoin(sites, eq(sites.id, siteEvents.siteId))
      .where(and(gte(siteEvents.date, todayIso), lte(siteEvents.date, in7), isNull(sites.archivedAt)))
      .orderBy(asc(siteEvents.date)),
    db.execute<{ n: number }>(sql`
      select count(*)::int as n from quotes q join sites s on s.id = q.site_id
      where s.status = 'active' and s.archived_at is null and q.status = 'accepted'
        and q.site_setup_at is null and q.deleted_at is null`),
    db.select({ n: sql<number>`count(*)::int` }).from(sites).where(isNotNull(sites.archivedAt)),
  ]);
  const upcoming = eventRows;
  const list = await loadSiteList(false, upcoming);

  const active = list.filter((s) => s.status === "active");
  const totals = {
    active: active.length,
    pending: list.length - active.length,
    archived: archivedCount[0]?.n ?? 0,
    inProgressValue: active.reduce((s, x) => s + x.metrics.contractNet, 0),
    invoiced: active.reduce((s, x) => s + x.metrics.invoiced, 0),
    milestonesTotal: active.reduce((s, x) => s + x.metrics.milestonesTotal, 0),
    toInvoice: active.reduce((s, x) => s + x.metrics.toInvoice, 0),
    toCollect: active.reduce((s, x) => s + x.metrics.toCollect, 0),
    late: active.filter((s) => s.metrics.health === "late").length,
    delayCost: active.reduce((s, x) => s + x.metrics.delayCost, 0),
  };

  const pendingWork = list.filter((s) => s.geoStatus === "pending").length + (pendingSetup.rows[0]?.n ?? 0);
  return { sites: list, upcoming, totals, pendingWork };
}

/** Archivio: cantieri conclusi o con il preventivo tornato indietro, dal più recente. */
export async function getArchivedSites(): Promise<{ sites: SiteListItem[] }> {
  return { sites: await loadSiteList(true) };
}

export type SiteDetail = {
  site: Site;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  quotes: SiteQuote[];
  phases: SitePhase[];
  milestones: (SiteMilestone & { value: number })[];
  events: SiteEvent[];
  notes: { id: string; body: string; createdAt: Date; updatedAt: Date | null; userId: string | null; userName: string | null }[];
  photos: (Omit<SitePhoto, "siteId"> & { userName: string | null })[];
  metrics: SiteMetrics;
  /** Fasi/SAL ancora da generare per preventivi accettati. */
  setupPending: boolean;
};

export async function getSiteDetail(id: string): Promise<SiteDetail | null> {
  const [[row], quoteRows, phases, milestones, events, notes, photos] = await Promise.all([
    db
      .select({ site: sites, clientName: clients.name, clientPhone: clients.phone, clientEmail: clients.email })
      .from(sites)
      .leftJoin(clients, eq(sites.clientId, clients.id))
      .where(eq(sites.id, id))
      .limit(1),
    getSiteQuotes(id),
    db.select().from(sitePhases).where(eq(sitePhases.siteId, id)).orderBy(asc(sitePhases.orderIndex)),
    db.select().from(siteMilestones).where(eq(siteMilestones.siteId, id)).orderBy(asc(siteMilestones.orderIndex)),
    db.select().from(siteEvents).where(eq(siteEvents.siteId, id)).orderBy(asc(siteEvents.date)),
    db
      .select({
        id: siteNotes.id,
        body: siteNotes.body,
        createdAt: siteNotes.createdAt,
        updatedAt: siteNotes.updatedAt,
        userId: siteNotes.userId,
        userName: users.name,
      })
      .from(siteNotes)
      .leftJoin(users, eq(siteNotes.userId, users.id))
      .where(eq(siteNotes.siteId, id))
      .orderBy(sql`${siteNotes.createdAt} desc`),
    db
      .select({
        id: sitePhotos.id,
        phaseId: sitePhotos.phaseId,
        publicId: sitePhotos.publicId,
        url: sitePhotos.url,
        width: sitePhotos.width,
        height: sitePhotos.height,
        caption: sitePhotos.caption,
        userId: sitePhotos.userId,
        createdAt: sitePhotos.createdAt,
        userName: users.name,
      })
      .from(sitePhotos)
      .leftJoin(users, eq(sitePhotos.userId, users.id))
      .where(eq(sitePhotos.siteId, id))
      .orderBy(desc(sitePhotos.createdAt)),
  ]);
  if (!row) return null;

  const quotes = orderQuotes(quoteRows, row.site.mainQuoteId);
  const quoteNet = new Map(quotes.map((q) => [q.id, q.net]));
  const mainNet = quotes[0]?.net ?? 0;
  const metrics = computeSiteMetrics({ site: row.site, quotes, milestones, phases });
  const valued = milestones.map((m) => ({
    ...m,
    value: milestoneAmount(m, quoteNet, mainNet),
  }));

  return {
    site: row.site,
    clientName: row.clientName,
    clientPhone: row.clientPhone,
    clientEmail: row.clientEmail,
    quotes,
    phases,
    milestones: valued,
    events,
    notes,
    photos,
    metrics,
    setupPending: !row.site.archivedAt && row.site.status === "active" && quotes.some((q) => q.status === "accepted" && !q.setupDone),
  };
}
