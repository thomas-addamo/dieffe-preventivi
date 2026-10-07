"use client";

import { useMenuParam } from "@/hooks/use-menu-param";
import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus,
  Search,
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  FilePlus2,
  Trash2,
  Filter,
  X,
  Link as LinkIcon,
  Upload,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page, SectionTitle, EmptyState } from "@/components/shared/Page";
import { WelcomeBriefing } from "./WelcomeBriefing";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDate,
  formatCurrency,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  cn,
} from "@/lib/utils";
import { useQuoteTabs } from "@/lib/stores/quote-tabs";
import { NewQuoteModal } from "@/components/quote-editor/NewQuoteModal";
import { ImportQuoteModal } from "@/components/quote-editor/ImportQuoteModal";
import { usePermissions } from "@/hooks/use-permissions";

type QuoteRow = {
  id: string;
  code: string;
  title: string;
  status: string;
  vatRate: number;
  createdAt: string;
  updatedAt: string;
  clientName: string | null;
  authorName: string;
  publicToken?: string | null;
  publicTokenExpiresAt?: Date | string | null;
  /** Imponibile (al netto dello sconto, IVA esclusa). */
  total: number;
  kind: "standard" | "extra";
  parentQuoteId: string | null;
};

/** Riga dell'archivio: il preventivo principale con i suoi lavori extra. */
type QuoteGroup = QuoteRow & { extras: QuoteRow[] };

type SortKey = "recent" | "updated" | "oldest" | "value" | "code" | "client";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Più recenti",
  updated: "Modificati di recente",
  oldest: "Meno recenti",
  value: "Importo più alto",
  code: "Codice",
  client: "Cliente (A→Z)",
};

const SORTERS: Record<SortKey, (a: QuoteRow, b: QuoteRow) => number> = {
  recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  value: (a, b) => b.total - a.total,
  code: (a, b) => b.code.localeCompare(a.code, "it", { numeric: true }),
  client: (a, b) => (a.clientName ?? "\uffff").localeCompare(b.clientName ?? "\uffff", "it"),
};

interface DashboardClientProps {
  initialQuotes: QuoteRow[];
  clients: { id: string; name: string }[];
  stats: { total: number; acceptedThisMonth: number; pending: number };
  currentUser: { id: string; name: string };
}

// Sezione "Aperti di recente": mette in evidenza gli ultimi preventivi aperti
// dall'utente (fonte: store dei tab, persistito in localStorage). Mappa gli id
// recenti sulle righe già caricate in pagina — nessuna fetch aggiuntiva.
function RecentQuotes({ quotes }: { quotes: QuoteRow[] }) {
  const router = useRouter();
  const recent = useQuoteTabs((s) => s.recent);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const items = useMemo(() => {
    if (!mounted) return [] as QuoteRow[];
    const byId = new Map(quotes.map((q) => [q.id, q]));
    return recent
      .map((r) => byId.get(r.id))
      .filter((q): q is QuoteRow => Boolean(q))
      .slice(0, 4);
  }, [mounted, recent, quotes]);

  if (items.length === 0) return null;

  return (
    <div className="mb-5 md:mb-6">
      <SectionTitle className="flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" /> Aperti di recente
      </SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((q) => (
          <button
            key={q.id}
            onClick={() => router.push(`/preventivi/${q.id}`)}
            className="surface group text-left transition-all hover:border-primary/40 hover:shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground truncate">{q.code}</span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  QUOTE_STATUS_COLORS[q.status]
                )}
              >
                {QUOTE_STATUS_LABELS[q.status]}
              </span>
            </div>
            <p className="mt-2 font-medium text-sm truncate group-hover:text-primary transition-colors">
              {q.title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {q.clientName ?? "Nessun cliente"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="surface flex items-start gap-3">
      <div className={`p-2 rounded-lg shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs leading-tight text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-lg font-bold tabular-nums md:text-xl">{value}</p>
      </div>
    </div>
  );
}

export function DashboardClient({
  initialQuotes,
  clients,
  stats,
  currentUser,
}: DashboardClientProps) {
  const router = useRouter();
  const { can: perms } = usePermissions();
  const [quotes, setQuotes] = useState(initialQuotes);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [showNewModal, setShowNewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Comandi dalla barra dei menu dell'app desktop.
  useMenuParam("nuovo", () => perms.createQuote && setShowNewModal(true));
  useMenuParam("importa", () => perms.createQuote && setShowImportModal(true));
  useMenuParam("cerca", () => {
    searchRef.current?.focus();
    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // I lavori extra non sono righe a sé: stanno nella tendina del loro preventivo.
  const filtered = useMemo<QuoteGroup[]>(() => {
    const extrasByParent = new Map<string, QuoteRow[]>();
    const ids = new Set(quotes.map((q) => q.id));
    for (const q of quotes) {
      if (q.kind === "extra" && q.parentQuoteId && ids.has(q.parentQuoteId)) {
        extrasByParent.set(q.parentQuoteId, [...(extrasByParent.get(q.parentQuoteId) ?? []), q]);
      }
    }
    const matches = (r: QuoteRow) => {
      if (search) {
        const q = search.toLowerCase();
        const hit =
          r.title.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          (r.clientName?.toLowerCase().includes(q) ?? false);
        if (!hit) return false;
      }
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (clientFilter !== "all" && r.clientName !== clientFilter) return false;
      return true;
    };
    const rows: QuoteGroup[] = quotes
      .filter((q) => !(q.kind === "extra" && q.parentQuoteId && ids.has(q.parentQuoteId)))
      .map((q) => ({
        ...q,
        extras: (extrasByParent.get(q.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      }))
      // Un gruppo resta visibile se il preventivo o uno dei suoi extra corrisponde ai filtri.
      .filter((g) => matches(g) || g.extras.some(matches));
    rows.sort(SORTERS[sort]);
    return rows;
  }, [quotes, search, statusFilter, clientFilter, sort]);

  async function deleteQuote(id: string) {
    if (!confirm("Spostare questo preventivo nel cestino?")) return;
    const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setQuotes((prev) => prev.filter((q) => q.id !== id));
      toast.success("Preventivo spostato nel cestino");
    } else {
      toast.error("Errore durante l'eliminazione");
    }
  }

  const uniqueClients = [...new Set(quotes.map((q) => q.clientName).filter(Boolean))] as string[];
  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (clientFilter !== "all" ? 1 : 0);

  return (
    <Page>
      <WelcomeBriefing
        userId={currentUser.id}
        userName={currentUser.name}
        actions={perms.createQuote && (
          <div className="hidden lg:flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
              className="gap-2"
            >
              <Upload className="w-4 h-4" /> Importa da file
            </Button>
            <Button onClick={() => setShowNewModal(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nuovo preventivo
            </Button>
          </div>
        )}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 md:mb-6">
        <StatCard
          icon={FileText}
          label="Preventivi totali"
          value={stats.total}
          color="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Accettati questo mese"
          value={stats.acceptedThisMonth}
          color="bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400"
        />
        <StatCard
          icon={Clock}
          label="In attesa di risposta"
          value={stats.pending}
          color="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
        />
        <StatCard
          icon={CheckCircle}
          label="Clienti attivi"
          value={clients.length}
          color="bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
        />
      </div>

      {/* Aperti di recente */}
      <RecentQuotes quotes={quotes} />

      {/* Archivio preventivi */}
      <SectionTitle className="flex items-center justify-between">
        <span>Archivio preventivi</span>
        <span className="normal-case tracking-normal tabular-nums">
          {filtered.length} preventiv{filtered.length === 1 ? "o" : "i"}
        </span>
      </SectionTitle>
      <div className="flex gap-2 mb-3 md:mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Cerca preventivi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Mobile import button */}
        {perms.createQuote && (
          <Button
            variant="outline"
            className="lg:hidden h-11 w-11 px-0 shrink-0"
            onClick={() => setShowImportModal(true)}
            aria-label="Importa da file"
          >
            <Upload className="w-4 h-4" />
          </Button>
        )}

        {/* Mobile filter button */}
        <Button
          variant="outline"
          className="lg:hidden gap-2 h-11 px-3 shrink-0"
          onClick={() => setShowMobileFilters(true)}
        >
          <Filter className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {/* Desktop filters inline */}
        <div className="hidden lg:flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              {Object.entries(QUOTE_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i clienti</SelectItem>
              {uniqueClients.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile filter sheet */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div
            className="modal-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="sheet-in md:modal-pop relative bg-background rounded-t-sheet p-5 space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Filtri</h3>
              <button onClick={() => setShowMobileFilters(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Stato</p>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  {Object.entries(QUOTE_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Cliente</p>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i clienti</SelectItem>
                  {uniqueClients.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Ordina per</p>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                    <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setStatusFilter("all"); setClientFilter("all"); }}
              >
                Rimuovi filtri
              </Button>
            )}
            <Button className="w-full" onClick={() => setShowMobileFilters(false)}>
              Applica
            </Button>
          </div>
        </div>
      )}

      {/* Archivio: un elenco di "tasti" larghi, lo stesso su computer e telefono */}
      {filtered.length === 0 ? (
        <div className="surface p-0">
          <EmptyState
            icon={FileText}
            title="Nessun preventivo trovato"
            description={
              search || statusFilter !== "all" || clientFilter !== "all"
                ? "Prova a modificare la ricerca o i filtri"
                : "Crea il tuo primo preventivo"
            }
            action={
              !search && statusFilter === "all" && perms.createQuote && (
                <Button size="sm" onClick={() => setShowNewModal(true)} className="mt-1 gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Nuovo preventivo
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((q) => (
            <QuoteGroupCard
              key={q.id}
              group={q}
              onDelete={perms.deleteQuote ? (id) => deleteQuote(id) : undefined}
            />
          ))}
        </div>
      )}

      {perms.createQuote && (
        <>
          <NewQuoteModal
            open={showNewModal}
            onClose={() => setShowNewModal(false)}
            onCreated={(id) => router.push(`/preventivi/${id}`)}
            clients={clients}
          />
          <ImportQuoteModal
            open={showImportModal}
            onClose={() => setShowImportModal(false)}
            onCreated={(id) => router.push(`/preventivi/${id}`)}
          />
        </>
      )}
    </Page>
  );
}

// ─── Riga dell'archivio ─────────────────────────────────────────────────────

/** Tessera colorata a sinistra: 40px a 16px dal bordo → raggio 12, concentrico alla card. */
/** Preventivo con i suoi lavori extra in una tendina che si apre sotto. */
function QuoteGroupCard({ group, onDelete }: { group: QuoteGroup; onDelete?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const extras = group.extras;
  return (
    <div>
      <QuoteCard
        quote={group}
        onDelete={onDelete ? () => onDelete(group.id) : undefined}
        extrasToggle={
          extras.length > 0 ? { count: extras.length, open, onToggle: () => setOpen((o) => !o) } : undefined
        }
      />
      {open && extras.length > 0 && (
        <div className="animate-slide-up mt-2 space-y-2 border-l-2 border-amber-300/70 pl-3 ml-5 sm:ml-[34px] dark:border-amber-500/40">
          {extras.map((x) => (
            <QuoteCard key={x.id} quote={x} onDelete={onDelete ? () => onDelete(x.id) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuoteCard({
  quote: q,
  onDelete,
  extrasToggle,
}: {
  quote: QuoteRow;
  onDelete?: () => void;
  extrasToggle?: { count: number; open: boolean; onToggle: () => void };
}) {
  const isExtra = q.kind === "extra";
  const linkActive =
    !!q.publicToken && !!q.publicTokenExpiresAt && new Date() < new Date(q.publicTokenExpiresAt);
  const status = (
    <Badge variant="secondary" className={cn("shrink-0 text-[11px]", QUOTE_STATUS_COLORS[q.status])}>
      {QUOTE_STATUS_LABELS[q.status] ?? q.status}
    </Badge>
  );

  return (
    <div className="surface group relative flex items-center gap-3 transition-all hover:border-primary/30 hover:shadow-sm active:scale-[.99] active:bg-accent lg:gap-5">
      {/* L'intera riga è il link; le azioni stanno sopra (z-10) */}
      <Link
        href={`/preventivi/${q.id}`}
        aria-label={`Apri ${q.code} — ${q.title}`}
        className="absolute inset-0 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />

      <span
        className={cn(
          "hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex",
          isExtra
            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
            : (QUOTE_STATUS_COLORS[q.status] ?? "bg-muted text-muted-foreground")
        )}
      >
        {isExtra ? <FilePlus2 className="h-[18px] w-[18px]" /> : <FileText className="h-[18px] w-[18px]" />}
      </span>

      {/* Codice + titolo (+ dettagli su telefono) */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-semibold text-primary">{q.code}</span>
          {isExtra && (
            <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Extra
            </span>
          )}
          {linkActive && (
            <LinkIcon className="h-3 w-3 text-blue-500" aria-label="Link pubblico attivo" />
          )}
          <span className="hidden truncate text-[11px] text-muted-foreground lg:inline">· {q.authorName}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug lg:line-clamp-1">{q.title}</p>
        <div className="mt-1.5 flex items-center gap-2 lg:hidden">
          {status}
          <span className="truncate text-xs text-muted-foreground">{q.clientName ?? q.authorName}</span>
          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground sm:hidden">
            {formatDate(q.createdAt)}
          </span>
        </div>
      </div>

      {/* Colonne allineate da desktop */}
      <div className="hidden w-48 min-w-0 shrink-0 lg:block">
        <p className="text-[11px] text-muted-foreground">Cliente</p>
        <p className="truncate text-sm">{q.clientName ?? "—"}</p>
      </div>
      <div className="hidden w-[92px] shrink-0 lg:block">
        <p className="text-[11px] text-muted-foreground">Data</p>
        <p className="text-sm tabular-nums">{formatDate(q.createdAt)}</p>
      </div>
      <div className="hidden w-24 shrink-0 lg:block">{status}</div>
      <div className="hidden w-28 shrink-0 text-right sm:block">
        <p className="text-[11px] text-muted-foreground">Imponibile</p>
        <p className="text-sm font-semibold tabular-nums">{formatCurrency(q.total)}</p>
        <p className="text-[11px] tabular-nums text-muted-foreground lg:hidden">{formatDate(q.createdAt)}</p>
      </div>

      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="relative z-10 hidden h-8 w-8 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 lg:flex"
          aria-label={`Sposta ${q.code} nel cestino`}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      {extrasToggle ? (
        <button
          type="button"
          onClick={extrasToggle.onToggle}
          aria-expanded={extrasToggle.open}
          aria-label={`${extrasToggle.open ? "Nascondi" : "Mostra"} lavori extra`}
          className="relative z-10 flex h-8 shrink-0 items-center gap-1 rounded-full bg-amber-100 pl-2.5 pr-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
        >
          +{extrasToggle.count} extra
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", extrasToggle.open && "rotate-180")} />
        </button>
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50" />
      )}
    </div>
  );
}
