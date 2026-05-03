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
    <div className="bg-card border rounded-lg p-5 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
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
  const [quotes, setQuotes] = useState(initialQuotes);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showNewModal, setShowNewModal] = useState(false);

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
    if (!confirm("Eliminare questo preventivo?")) return;
    const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setQuotes((prev) => prev.filter((q) => q.id !== id));
      toast.success("Preventivo eliminato");
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestione preventivi e stato lavori
          </p>
        </div>
        <Button onClick={() => setShowNewModal(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nuovo Preventivo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={FileText}
          label="Preventivi totali"
          value={stats.total}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Accettati questo mese"
          value={stats.acceptedThisMonth}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          icon={Clock}
          label="In attesa di risposta"
          value={stats.pending}
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={CheckCircle}
          label="Clienti attivi"
          value={clients.length}
          color="bg-violet-50 text-violet-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per codice, titolo, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
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

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
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
              <TableHead className="w-20">Azioni</TableHead>
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
                      <Button
                        size="sm"
                        onClick={() => setShowNewModal(true)}
                        className="mt-1"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Nuovo preventivo
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((q, i) => (
                <TableRow
                  key={q.id}
                  className={i % 2 === 1 ? "bg-muted/20" : ""}
                >
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
                    <Badge
                      variant="secondary"
                      className={`text-xs ${QUOTE_STATUS_COLORS[q.status] ?? ""}`}
                    >
                      {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {formatDate(q.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {q.authorName}
                  </TableCell>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2 text-right">
          {filtered.length} preventiv{filtered.length === 1 ? "o" : "i"}
        </p>
      )}

      <NewQuoteModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={(id) => router.push(`/preventivi/${id}`)}
        clients={clients}
      />
    </div>
  );
}
