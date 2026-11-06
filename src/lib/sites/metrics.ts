// ─────────────────────────────────────────────────────────────────────────────
// Metriche di un cantiere: avanzamento, fatturazione, tempi e costo del ritardo.
// Funzioni pure (niente DB): le usano il server, la dashboard e la pagina del
// cantiere, e domani l'app iPhone riceve gli stessi numeri dalle API.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;

export type MetricsPhase = {
  weight: number;
  doneAt: string | Date | null;
  plannedEnd?: string | null;
};

export type MetricsMilestone = {
  quoteId: string | null;
  percent: number | null;
  amount: number | null;
  reachedAt: string | Date | null;
  invoicedAt: string | Date | null;
  paidAt: string | Date | null;
};

export type MetricsQuote = { id: string; net: number; vatRate: number; status: string };

export type MetricsSite = {
  status: string;
  startDate: string | null;
  plannedEndDate: string | null;
  dailyCost: number | null;
  penaltyPerDay: number | null;
  marginPct: number;
  progress: number;
};

export type SiteHealth = "pending" | "not_started" | "on_track" | "at_risk" | "late" | "done";

export type SiteMetrics = {
  /** Imponibile dei preventivi accettati del cantiere. */
  contractNet: number;
  contractGross: number;
  progress: number;
  /** Totale SAL (imponibile) e suddivisione. */
  milestonesTotal: number;
  invoiced: number;
  paid: number;
  /** SAL raggiunti e non ancora fatturati: soldi fermi. */
  toInvoice: number;
  /** Fatturato ma non incassato. */
  toCollect: number;
  elapsedDays: number | null;
  plannedDays: number | null;
  /** Avanzamento atteso oggi secondo il programma (0–100). */
  expectedProgress: number | null;
  forecastEnd: string | null;
  delayDays: number;
  dailyBurn: number;
  delayCost: number;
  margin: number;
  marginAfterDelay: number;
  /** Giorni di ritardo oltre i quali il cantiere va in perdita. */
  breakEvenDelayDays: number | null;
  health: SiteHealth;
};

/** Importo (imponibile) di un SAL: percentuale del suo preventivo o importo fisso. */
export function milestoneAmount(m: Pick<MetricsMilestone, "quoteId" | "percent" | "amount">, quoteNet: Map<string, number>, fallbackNet: number) {
  if (m.amount != null) return m.amount;
  if (m.percent == null) return 0;
  const base = (m.quoteId ? quoteNet.get(m.quoteId) : undefined) ?? fallbackNet;
  return (base * m.percent) / 100;
}

/** Numero del giorno di calendario (locale), confrontabile e sottraibile. */
export function toDay(d: string | Date): number {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, dd] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, dd) / DAY;
  }
  const date = typeof d === "string" ? new Date(d) : d;
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY;
}

export function isoDay(dayNumber: number): string {
  const d = new Date(dayNumber * DAY);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Aggiunge giorni lavorativi (lun–ven) a un giorno di calendario. */
export function addWorkdays(day: number, workdays: number): number {
  let d = day;
  let left = Math.max(0, workdays);
  while (left > 0) {
    d += 1;
    const wd = new Date(d * 86_400_000).getUTCDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d;
}

/** Avanzamento pesato sull'importo delle fasi (a numero di fasi se senza importi). */
export function computeProgress(phases: MetricsPhase[]): number {
  if (phases.length === 0) return 0;
  const total = phases.reduce((s, p) => s + Math.max(0, p.weight), 0);
  if (total > 0) {
    const done = phases.filter((p) => p.doneAt).reduce((s, p) => s + Math.max(0, p.weight), 0);
    return (done / total) * 100;
  }
  return (phases.filter((p) => p.doneAt).length / phases.length) * 100;
}

export function computeSiteMetrics(input: {
  site: MetricsSite;
  quotes: MetricsQuote[];
  milestones: MetricsMilestone[];
  /** Fasi con le date previste: servono per avanzamento atteso e ritardo. */
  phases?: { weight: number; plannedStart: string | null; plannedEnd: string | null }[];
  today?: Date;
}): SiteMetrics {
  const { site, milestones } = input;
  const accepted = input.quotes.filter((q) => q.status === "accepted");
  const contractNet = accepted.reduce((s, q) => s + q.net, 0);
  const contractGross = accepted.reduce((s, q) => s + q.net * (1 + q.vatRate / 100), 0);
  const quoteNet = new Map(input.quotes.map((q) => [q.id, q.net]));
  const mainNet = input.quotes[0]?.net ?? 0;

  let milestonesTotal = 0, invoiced = 0, paid = 0, toInvoice = 0;
  for (const m of milestones) {
    const a = milestoneAmount(m, quoteNet, mainNet);
    milestonesTotal += a;
    if (m.invoicedAt) invoiced += a;
    if (m.paidAt) paid += a;
    if (m.reachedAt && !m.invoicedAt) toInvoice += a;
  }

  const progress = site.progress;
  const today = toDay(input.today ?? new Date());
  const start = site.startDate ? toDay(site.startDate) : null;
  const plannedEnd = site.plannedEndDate ? toDay(site.plannedEndDate) : null;

  const elapsedDays = start != null ? Math.max(0, today - start) : null;
  const plannedDays = start != null && plannedEnd != null ? Math.max(1, plannedEnd - start) : null;

  // Programma delle fasi (date previste + peso): curva "avanzamento atteso nel
  // tempo". Senza fasi programmate si usa una retta inizio → fine prevista.
  const planned = (input.phases ?? [])
    .filter((p) => p.plannedStart && p.plannedEnd)
    .map((p) => ({ w: Math.max(0, p.weight), s: toDay(p.plannedStart!), e: toDay(p.plannedEnd!) + 1 }));
  const plannedTotal = planned.reduce((a, p) => a + p.w, 0) || planned.length;
  const plannedAt = (day: number): number => {
    if (planned.length === 0) {
      return start != null && plannedDays != null ? Math.min(100, Math.max(0, ((day - start) / plannedDays) * 100)) : 0;
    }
    let acc = 0;
    for (const p of planned) acc += (plannedTotal === planned.length ? 1 : p.w) * Math.min(1, Math.max(0, (day - p.s) / Math.max(1, p.e - p.s)));
    return (acc / plannedTotal) * 100;
  };
  const expectedProgress = start != null && (plannedDays != null || planned.length) ? Math.min(100, plannedAt(today)) : null;

  // Ritardo con il metodo "Earned Schedule": il giorno in cui il programma
  // prevedeva l'avanzamento raggiunto oggi; la distanza da oggi sono i giorni
  // di ritardo, e la fine slitta di altrettanto (il resto al ritmo previsto).
  // Più stabile della proiezione lineare, che all'inizio esagera.
  let delayDays = 0;
  if (start != null && plannedEnd != null && progress < 100 && today > start) {
    let earned = start;
    while (earned < today && plannedAt(earned + 1) <= progress + 0.01) earned++;
    delayDays = Math.max(0, today - earned - 1);
    if (today > plannedEnd) delayDays = Math.max(delayDays, today - plannedEnd);
  }
  const forecast: number | null =
    start == null ? null : progress >= 100 ? today : plannedEnd != null ? plannedEnd + delayDays : null;

  const dailyBurn = (site.dailyCost ?? 0) + (site.penaltyPerDay ?? 0);
  const delayCost = delayDays * dailyBurn;
  const margin = (contractNet * site.marginPct) / 100;
  const marginAfterDelay = margin - delayCost;
  const breakEvenDelayDays = dailyBurn > 0 ? Math.floor(margin / dailyBurn) : null;

  let health: SiteHealth;
  if (site.status === "pending") health = "pending";
  else if (progress >= 100) health = "done";
  else if (start == null || today < start) health = "not_started";
  // Qualche giorno di scarto è fisiologico: "in ritardo" da 5 giorni in su.
  else if (delayDays >= 5) health = "late";
  else if (delayDays > 0) health = "at_risk";
  else health = "on_track";

  return {
    contractNet,
    contractGross,
    progress,
    milestonesTotal,
    invoiced,
    paid,
    toInvoice,
    toCollect: Math.max(0, invoiced - paid),
    elapsedDays,
    plannedDays,
    expectedProgress,
    forecastEnd: forecast != null ? isoDay(forecast) : null,
    delayDays,
    dailyBurn,
    delayCost,
    margin,
    marginAfterDelay,
    breakEvenDelayDays,
    health,
  };
}

export const HEALTH_LABELS: Record<SiteHealth, string> = {
  pending: "In attesa",
  not_started: "Da avviare",
  on_track: "In tempo",
  at_risk: "A rischio",
  late: "In ritardo",
  done: "Completato",
};

export const HEALTH_COLORS: Record<SiteHealth, string> = {
  pending: "#94a3b8",
  not_started: "#3b82f6",
  on_track: "#10b981",
  at_risk: "#f59e0b",
  late: "#ef4444",
  done: "#8b5cf6",
};
