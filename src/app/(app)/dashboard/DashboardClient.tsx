"use client";

import { useState, useMemo } from "react";
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
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Trash2,
  Eye,
  Filter,
  X,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDate,
  formatCurrency,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
} from "@/lib/utils";
import { NewQuoteModal } from "@/components/quote-editor/NewQuoteModal";
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
};

type SortKey = keyof QuoteRow;
type SortDir = "asc" | "desc";

interface DashboardClientProps {
  initialQuotes: QuoteRow[];
  clients: { id: string; name: string }[];
  stats: { total: number; acceptedThisMonth: number; pending: number };
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
    <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export function DashboardClient({
  initialQuotes,
  clients,
  stats,
}: DashboardClientProps) {
  const router = useRouter();
  const { can: perms } = usePermissions();
  const [quotes, setQuotes] = useState(initialQuotes);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showNewModal, setShowNewModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const filtered = useMemo(() => {
    let rows = [...quotes];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          (r.clientName?.toLowerCase().includes(q) ?? false)
      );
    }
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    if (clientFilter !== "all") rows = rows.filter((r) => r.clientName === clientFilter);
    rows.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [quotes, search, statusFilter, clientFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

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

  function SortIcon({ col }: { col: SortKey }) {
    if (col !== sortKey) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5" />
    );
  }

  const uniqueClients = [...new Set(quotes.map((q) => q.clientName).filter(Boolean))] as string[];
  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (clientFilter !== "all" ? 1 : 0);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto pb-20 lg:pb-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Dashboard</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Gestione preventivi e stato lavori
          </p>
        </div>
        {perms.createQuote && (
          <Button onClick={() => setShowNewModal(true)} className="gap-2 hidden lg:flex">
            <Plus className="w-4 h-4" /> Nuovo Preventivo
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 md:mb-6">
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

      {/* Search + filters bar */}
      <div className="flex gap-2 mb-3 md:mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca preventivi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 md:h-9 text-base md:text-sm"
          />
        </div>

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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="relative bg-background rounded-t-2xl p-5 space-y-4 pb-8">
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

      {/* Desktop table */}
      <div className="hidden lg:block border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {[
                { key: "code", label: "Codice" },
                { key: "title", label: "Titolo" },
                { key: "clientName", label: "Cliente" },
                { key: "status", label: "Stato" },
                { key: "createdAt", label: "Data" },
                { key: "authorName", label: "Autore" },
              ].map(({ key, label }) => (
                <TableHead
                  key={key}
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort(key as SortKey)}
                >
                  <span className="flex items-center gap-1">
                    {label}
                    <SortIcon col={key as SortKey} />
                  </span>
                </TableHead>
              ))}
              {perms.deleteQuote && <TableHead className="w-20">Azioni</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <FileText className="w-10 h-10 opacity-30" />
                    <p className="font-medium">Nessun preventivo trovato</p>
                    <p className="text-sm">
                      {search || statusFilter !== "all"
                        ? "Prova a modificare i filtri di ricerca"
                        : "Crea il tuo primo preventivo"}
                    </p>
                    {!search && statusFilter === "all" && (
                      <Button size="sm" onClick={() => setShowNewModal(true)} className="mt-1">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Nuovo preventivo
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((q, i) => (
                <TableRow key={q.id} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                  <TableCell>
                    <Link
                      href={`/preventivi/${q.id}`}
                      className="font-mono text-xs font-medium text-primary hover:underline"
                    >
                      {q.code}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{q.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {q.clientName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${QUOTE_STATUS_COLORS[q.status] ?? ""}`}
                      >
                        {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                      </Badge>
                      {q.publicToken && q.publicTokenExpiresAt && new Date() < new Date(q.publicTokenExpiresAt) && (
                        <span title="Link pubblico attivo" className="text-blue-500 inline-flex">
                          <LinkIcon className="w-3.5 h-3.5" aria-label="Link pubblico attivo" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {formatDate(q.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {q.authorName}
                  </TableCell>
                  {perms.deleteQuote && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/preventivi/${q.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteQuote(q.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="lg:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground py-12">
            <FileText className="w-10 h-10 opacity-30" />
            <p className="font-medium">Nessun preventivo trovato</p>
            <p className="text-sm text-center">
              {search || statusFilter !== "all"
                ? "Prova a modificare i filtri"
                : "Crea il tuo primo preventivo"}
            </p>
          </div>
        ) : (
          filtered.map((q) => (
            <Link key={q.id} href={`/preventivi/${q.id}`}>
              <div className="bg-card border rounded-xl p-4 space-y-2 active:bg-muted/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-medium text-primary">
                    {q.code}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {q.publicToken && q.publicTokenExpiresAt && new Date() < new Date(q.publicTokenExpiresAt) && (
                      <span title="Link pubblico attivo" className="inline-flex text-blue-500">
                        <LinkIcon className="w-3.5 h-3.5" aria-label="Link pubblico attivo" />
                      </span>
                    )}
                    <Badge
                      variant="secondary"
                      className={`text-xs ${QUOTE_STATUS_COLORS[q.status] ?? ""}`}
                    >
                      {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                    </Badge>
                  </div>
                </div>
                <p className="font-medium text-sm leading-tight line-clamp-2">{q.title}</p>
                {q.clientName && (
                  <p className="text-xs text-muted-foreground">{q.clientName}</p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {/* We don't have the total here, show author */}
                    {q.authorName}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(q.createdAt)}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2 text-right">
          {filtered.length} preventiv{filtered.length === 1 ? "o" : "i"}
        </p>
      )}

      {perms.createQuote && (
        <button
          onClick={() => setShowNewModal(true)}
          className="fixed bottom-6 right-6 z-40 lg:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
          aria-label="Nuovo preventivo"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {perms.createQuote && (
        <NewQuoteModal
          open={showNewModal}
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => router.push(`/preventivi/${id}`)}
          clients={clients}
        />
      )}
    </div>
  );
}
