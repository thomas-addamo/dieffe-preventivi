"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

/** Oltre questo tempo la dashboard smette di ricontrollare (un elemento bloccato non la fa girare per sempre). */
const MAX_POLL_MS = 3 * 60_000;
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  Banknote,
  CalendarDays,
  ChevronRight,
  HardHat,
  Loader2,
  MapPin,
  Receipt,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";
import { EmptyState, Page, PageHeader, SectionTitle } from "@/components/shared/Page";
import { cn, formatCurrency } from "@/lib/utils";
import type { SitesOverview, SiteListItem } from "@/lib/sites/queries";
import {
  EVENT_TYPES,
  HealthBadge,
  ProgressBar,
  formatShortDate,
  siteTitle,
  type EventType,
} from "@/components/sites/site-ui";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Gestione Cantieri: mappa, panoramica economica e di tempi,
// prossimi eventi, consigli IA ed elenco dei cantieri.
// ─────────────────────────────────────────────────────────────────────────────

const SitesMap = dynamic(() => import("@/components/sites/SitesMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-[inherit] bg-muted" />,
});

type Filter = "active" | "pending" | "all" | "archive";

async function fetchOverview(): Promise<SitesOverview> {
  const res = await fetch("/api/sites");
  if (!res.ok) throw new Error("Errore nel caricamento dei cantieri");
  return res.json();
}

async function fetchArchive(): Promise<{ sites: SiteListItem[] }> {
  const res = await fetch("/api/sites/archive");
  if (!res.ok) throw new Error("Errore nel caricamento dell'archivio");
  return res.json();
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  children,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "default" | "amber" | "red" | "green";
  children?: React.ReactNode;
}) {
  const tones = {
    default: "bg-primary/10 text-primary",
    amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    red: "bg-red-500/12 text-red-600 dark:text-red-400",
    green: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  };
  return (
    <div className="surface flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={cn("rounded-lg p-1.5", tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="truncate text-xl font-bold tabular-nums">{value}</p>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      {children}
    </div>
  );
}

function SiteRow({ s, selected, onSelect }: { s: SiteListItem; selected: boolean; onSelect: () => void }) {
  const m = s.metrics;
  const pending = s.status === "pending" && !s.archivedAt;
  return (
    <div
      className={cn(
        "surface group flex flex-col gap-3 transition-colors md:flex-row md:items-center",
        selected && "border-primary/50 ring-2 ring-primary/15",
        pending && "opacity-80"
      )}
    >
      <button onClick={onSelect} className="min-w-0 flex-1 text-left" title="Mostra sulla mappa">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{siteTitle(s.name)}</p>
          {s.archivedAt ? (
            <span className="shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
              {s.archiveReason === "completed" ? `Concluso il ${formatShortDate(s.archivedAt)}` : "Preventivo ritirato"}
            </span>
          ) : (
            <HealthBadge health={m.health} />
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          {s.clientName ?? "Nessun cliente"} · {s.address ?? "Indirizzo mancante"}
          {s.geoStatus === "failed" && <span className="text-amber-600"> · posizione non trovata</span>}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {s.quotes.map((q) => (
            <span
              key={q.id}
              className={cn(
                "rounded-md px-1.5 py-0.5 font-mono text-[10px]",
                q.kind === "extra" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-foreground/[0.06] text-muted-foreground"
              )}
            >
              {q.code}
            </span>
          ))}
        </div>
      </button>

      {!pending ? (
        <div className="grid grid-cols-3 gap-3 text-xs md:w-[420px] md:shrink-0">
          <div className="col-span-3 flex items-center gap-2">
            <ProgressBar value={m.progress} expected={m.expectedProgress} health={m.health} />
            <span className="w-10 text-right font-semibold tabular-nums">{Math.round(m.progress)}%</span>
          </div>
          <div>
            <p className="text-muted-foreground">Fatturato</p>
            <p className="font-medium tabular-nums">{formatCurrency(m.invoiced)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Da fatturare</p>
            <p className={cn("font-medium tabular-nums", m.toInvoice > 0 && "text-amber-600 dark:text-amber-400")}>
              {formatCurrency(m.toInvoice)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Fine</p>
            <p className={cn("font-medium", m.delayDays > 0 && "text-red-600 dark:text-red-400")}>
              {s.plannedEndDate ? formatShortDate(m.delayDays > 0 ? m.forecastEnd : s.plannedEndDate) : "da fissare"}
              {m.delayDays > 0 && <span className="font-normal"> (+{m.delayDays}g)</span>}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground md:w-[420px] md:shrink-0">
          Preventivo inviato · {formatCurrency(s.quotes.reduce((a, q) => a + q.net, 0))} + IVA. Diventa attivo quando viene accettato.
        </p>
      )}

      <Link
        href={`/cantieri/${s.id}`}
        className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:w-auto"
        aria-label={`Apri ${s.name}`}
      >
        <span className="md:hidden">Apri</span>
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function CantieriClient({ initial }: { initial: SitesOverview }) {
  const [openedAt] = useState(() => Date.now());
  // Finché il server prepara cantieri (posizione, fasi e SAL dell'IA) la
  // dashboard si aggiorna da sola ogni pochi secondi: il lavoro lo fa il
  // server dopo ogni lettura, il browser non deve "spingerlo".
  const { data = initial } = useQuery({
    queryKey: ["sites"],
    queryFn: fetchOverview,
    initialData: initial,
    staleTime: 30_000,
    refetchInterval: (q) => ((q.state.data?.pendingWork ?? 0) > 0 && Date.now() - openedAt < MAX_POLL_MS ? 5000 : false),
  });
  const working = data.pendingWork > 0;
  const params = useSearchParams();
  const [filter, setFilter] = useState<Filter>(params.get("filtro") === "archivio" ? "archive" : "active");
  const archive = useQuery({ queryKey: ["sites", "archive"], queryFn: fetchArchive, enabled: filter === "archive", staleTime: 60_000 });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const t = data.totals;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = filter === "archive" ? (archive.data?.sites ?? []) : data.sites;
    return source
      .filter((s) => filter === "all" || filter === "archive" || s.status === filter)
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          (s.clientName ?? "").toLowerCase().includes(q) ||
          (s.address ?? "").toLowerCase().includes(q) ||
          s.quotes.some((x) => x.code.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        // Archivio: dal più recente. Altrimenti prima ciò che richiede
        // attenzione: ritardo, rischio, soldi da fatturare.
        if (filter === "archive") return (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "");
        const rank = { late: 0, at_risk: 1, on_track: 2, not_started: 3, done: 4, pending: 5 } as const;
        return rank[a.metrics.health] - rank[b.metrics.health] || b.metrics.toInvoice - a.metrics.toInvoice;
      });
  }, [data.sites, archive.data, filter, search]);
  // La mappa mostra i cantieri del filtro scelto (gli "in attesa" non affollano la vista dei lavori in corso).
  const mapSites = useMemo(() => {
    if (filter === "archive") return archive.data?.sites ?? [];
    if (filter === "all") return data.sites;
    return data.sites.filter((s) => s.status === filter);
  }, [data.sites, archive.data, filter]);

  const tips = data.sites
    .filter((s) => s.topTip)
    .sort((a, b) => (a.topTip!.priority === "alta" ? -1 : 0) - (b.topTip!.priority === "alta" ? -1 : 0))
    .slice(0, 3);
  const invoicedPct = t.milestonesTotal > 0 ? (t.invoiced / t.milestonesTotal) * 100 : 0;

  return (
    <Page>
      <PageHeader
        title="Gestione Cantieri"
        subtitle={`${t.active} attivi · ${t.pending} in attesa di accettazione`}
        actions={
          working ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> L’IA sta preparando i cantieri…
            </span>
          ) : null
        }
      />

      {data.sites.length === 0 && !t.archived ? (
        <EmptyState
          icon={HardHat}
          title="Nessun cantiere"
          description="I cantieri nascono da soli quando un preventivo viene inviato o accettato."
        />
      ) : (
        <>
          {/* Panoramica */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={Receipt}
              label="Da fatturare adesso"
              value={formatCurrency(t.toInvoice)}
              tone={t.toInvoice > 0 ? "amber" : "default"}
              hint="SAL raggiunti, non ancora fatturati (+ IVA)"
            />
            <Kpi icon={Banknote} label="Lavori in corso" value={formatCurrency(t.inProgressValue)} hint={`${t.active} cantieri attivi, imponibile`} />
            <Kpi icon={Wallet} label="Fatturato" value={formatCurrency(t.invoiced)} hint={`${Math.round(invoicedPct)}% dei SAL · da incassare ${formatCurrency(t.toCollect)}`}>
              <ProgressBar value={invoicedPct} thin />
            </Kpi>
            <Kpi
              icon={AlertTriangle}
              label="Cantieri in ritardo"
              value={String(t.late)}
              tone={t.late > 0 ? "red" : "green"}
              hint={t.late > 0 ? `Costo stimato del ritardo: ${formatCurrency(t.delayCost)}` : "Tutti nei tempi previsti"}
            />
          </div>

          {/* Mappa + colonna laterale */}
          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="surface relative h-[360px] overflow-hidden !p-0 md:h-[460px] lg:col-span-2">
              <SitesMap sites={mapSites} selectedId={selected} onSelect={setSelected} className="h-full w-full" />
              <div className="pointer-events-none absolute bottom-2 left-2 z-[400] flex flex-wrap gap-1.5 rounded-xl bg-card/90 px-2.5 py-1.5 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
                {(["on_track", "at_risk", "late", "not_started", "pending"] as const).map((h) => (
                  <HealthBadge key={h} health={h} className="!bg-transparent !px-0" />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="surface">
                <SectionTitle className="mb-3 flex items-center gap-1.5 px-0">
                  <CalendarDays className="h-3.5 w-3.5" /> Prossimi 7 giorni
                </SectionTitle>
                {data.upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun evento in calendario.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {data.upcoming.slice(0, 6).map((e, i) => {
                      const meta = EVENT_TYPES[e.type as EventType] ?? EVENT_TYPES.altro;
                      return (
                        <li key={i}>
                          <Link href={`/cantieri/${e.siteId}?tab=calendario`} className="flex gap-2.5 rounded-lg hover:bg-accent/60">
                            <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full" style={{ background: meta.color }} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{e.title}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {formatShortDate(e.date)} · {meta.label} · {siteTitle(e.siteName)}
                              </p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="surface flex-1">
                <SectionTitle className="mb-3 flex items-center gap-1.5 px-0">
                  <Sparkles className="h-3.5 w-3.5" /> Consigli dell’IA
                </SectionTitle>
                {tips.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    I consigli compaiono aprendo i cantieri attivi: l’IA li prepara sui loro dati reali.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {tips.map((s) => (
                      <li key={s.id}>
                        <Link href={`/cantieri/${s.id}?tab=note`} className="block rounded-lg hover:bg-accent/60">
                          <p className="text-sm font-medium">
                            {s.topTip!.priority === "alta" && <span className="mr-1 text-red-500">●</span>}
                            {s.topTip!.title}
                          </p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{s.topTip!.body}</p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">{siteTitle(s.name)}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Elenco */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-muted p-1 text-sm">
              {(
                [
                  ["active", `Attivi (${t.active})`],
                  ["pending", `In attesa (${t.pending})`],
                  ["all", "Tutti"],
                  ["archive", `Archivio (${t.archived ?? 0})`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={cn(
                    "rounded-lg px-3 py-1 font-medium transition-colors",
                    filter === k ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca cantiere, cliente, indirizzo…"
                className="h-9 w-full rounded-xl border bg-card pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>

          <div className="space-y-2">
            {filter === "archive" && archive.isLoading ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Caricamento dell’archivio…
              </p>
            ) : filtered.length === 0 ? (
              <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                {filter === "archive" && <Archive className="h-6 w-6 opacity-50" />}
                {filter === "archive"
                  ? "Archivio vuoto: qui finiscono i cantieri con i lavori conclusi e quelli il cui preventivo torna indietro."
                  : "Nessun cantiere."}
              </p>
            ) : (
              filtered.map((s) => (
                <SiteRow
                  key={s.id}
                  s={s}
                  selected={s.id === selected}
                  onSelect={() => {
                    setSelected(s.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              ))
            )}
          </div>
        </>
      )}
    </Page>
  );
}
