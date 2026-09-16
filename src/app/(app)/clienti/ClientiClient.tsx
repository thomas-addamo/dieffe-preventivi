"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  Building2,
  Mail,
  Phone,
  FileText,
  MapPin,
  ChevronDown,
  ChevronRight,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  cn,
  formatCurrency,
  formatDate,
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
} from "@/lib/utils";
import type { Client } from "@/lib/db/schema";
import { usePermissions } from "@/hooks/use-permissions";

export type ClientQuote = {
  id: string;
  code: string;
  title: string;
  status: string;
  createdAt: string;
  total: number;
};

export type ClientWithQuotes = Client & { quotes: ClientQuote[] };

const schema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  address: z.string().optional(),
  vatNumber: z.string().optional(),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type SortKey = "recent" | "name" | "quotes" | "value";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Aggiunti di recente",
  name: "Nome (A→Z)",
  quotes: "Più preventivi",
  value: "Valore accettato",
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Valore dei soli preventivi accettati: è il dato che conta davvero. */
function acceptedValue(quotes: ClientQuote[]) {
  return quotes
    .filter((q) => q.status === "accepted")
    .reduce((sum, q) => sum + q.total, 0);
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        QUOTE_STATUS_COLORS[status] ?? "bg-zinc-100 text-zinc-700"
      )}
    >
      {QUOTE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
        className
      )}
    >
      {initials(name) || "?"}
    </div>
  );
}

/** Elenco dei preventivi di un cliente, con link diretto all'editor. */
function QuoteList({
  quotes,
  onNavigate,
}: {
  quotes: ClientQuote[];
  onNavigate?: () => void;
}) {
  if (quotes.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Nessun preventivo collegato a questo cliente.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {quotes.map((q) => (
        <Link
          key={q.id}
          href={`/preventivi/${q.id}`}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent active:bg-accent"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{q.title}</p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {q.code} · {formatDate(q.createdAt)}
            </p>
          </div>
          <StatusBadge status={q.status} />
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {formatCurrency(q.total)}
          </span>
        </Link>
      ))}
    </div>
  );
}

// ─── Pagina ──────────────────────────────────────────────────────────────────

export function ClientiClient({
  initialClients,
}: {
  initialClients: ClientWithQuotes[];
}) {
  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [editing, setEditing] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientWithQuotes | null>(null);
  const { can: perms } = usePermissions();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? clients.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.email?.toLowerCase().includes(q) ?? false) ||
            (c.phone?.toLowerCase().includes(q) ?? false) ||
            (c.vatNumber?.toLowerCase().includes(q) ?? false) ||
            c.quotes.some(
              (quote) =>
                quote.code.toLowerCase().includes(q) ||
                quote.title.toLowerCase().includes(q)
            )
        )
      : clients;

    const sorted = [...base];
    switch (sort) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "it"));
        break;
      case "quotes":
        sorted.sort((a, b) => b.quotes.length - a.quotes.length);
        break;
      case "value":
        sorted.sort((a, b) => acceptedValue(b.quotes) - acceptedValue(a.quotes));
        break;
      default:
        sorted.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
    return sorted;
  }, [clients, search, sort]);

  const totalQuotes = clients.reduce((s, c) => s + c.quotes.length, 0);
  const totalAccepted = clients.reduce((s, c) => s + acceptedValue(c.quotes), 0);

  function openNew() {
    setEditing(null);
    reset({
      name: "",
      address: "",
      vatNumber: "",
      email: "",
      phone: "",
      notes: "",
    });
    setShowForm(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    reset({
      name: client.name,
      address: client.address ?? "",
      vatNumber: client.vatNumber ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      notes: client.notes ?? "",
    });
    setShowForm(true);
  }

  async function onSubmit(data: FormData) {
    if (editing) {
      const res = await fetch(`/api/clients/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = (await res.json()) as Client;
        setClients((prev) =>
          prev.map((c) => (c.id === editing.id ? { ...updated, quotes: c.quotes } : c))
        );
        setDetail((d) => (d && d.id === editing.id ? { ...updated, quotes: d.quotes } : d));
        toast.success("Cliente aggiornato");
        setShowForm(false);
      } else {
        toast.error("Errore durante il salvataggio");
      }
    } else {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created = (await res.json()) as Client;
        setClients((prev) => [{ ...created, quotes: [] }, ...prev]);
        toast.success("Cliente creato");
        setShowForm(false);
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Errore");
      }
    }
  }

  async function deleteClient(client: ClientWithQuotes) {
    const warn =
      client.quotes.length > 0
        ? `"${client.name}" ha ${client.quotes.length} preventiv${
            client.quotes.length === 1 ? "o" : "i"
          } collegat${client.quotes.length === 1 ? "o" : "i"}, che resteranno senza cliente. Eliminare comunque?`
        : `Eliminare "${client.name}"?`;
    if (!confirm(warn)) return;
    const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== client.id));
      setDetail(null);
      toast.success("Cliente eliminato");
    } else {
      toast.error("Errore durante l'eliminazione");
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Intestazione */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold lg:text-xl lg:font-semibold">Clienti</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clients.length} client{clients.length === 1 ? "e" : "i"} ·{" "}
            {totalQuotes} preventiv{totalQuotes === 1 ? "o" : "i"} collegat
            {totalQuotes === 1 ? "o" : "i"}
          </p>
        </div>
        {perms.manageClients && (
          <>
            <Button onClick={openNew} className="gap-2 hidden lg:flex shrink-0">
              <Plus className="w-4 h-4" /> Nuovo cliente
            </Button>
            <button
              onClick={openNew}
              aria-label="Nuovo cliente"
              className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition-transform active:scale-90"
            >
              <Plus className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Riepilogo rapido */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <SummaryTile label="Clienti" value={String(clients.length)} />
        <SummaryTile label="Preventivi" value={String(totalQuotes)} />
        <SummaryTile label="Valore accettato" value={formatCurrency(totalAccepted)} />
      </div>

      {/* Ricerca + ordinamento */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, email, P.IVA o preventivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="sm:w-56 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SORT_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tabella desktop ── */}
      <div className="hidden lg:block border rounded-xl overflow-hidden bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-8" />
              <TableHead>Cliente</TableHead>
              <TableHead>Contatti</TableHead>
              <TableHead>P.IVA / CF</TableHead>
              <TableHead className="text-right">Preventivi</TableHead>
              <TableHead>Ultimo preventivo</TableHead>
              {perms.manageClients && <TableHead className="w-20">Azioni</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={perms.manageClients ? 7 : 6}
                  className="text-center py-12 text-muted-foreground"
                >
                  {search ? "Nessun cliente trovato" : "Nessun cliente ancora. Aggiungine uno!"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => {
                const expanded = expandedId === c.id;
                const last = c.quotes[0];
                const value = acceptedValue(c.quotes);
                return (
                  <Fragment key={c.id}>
                    <TableRow
                      className={cn(
                        "cursor-pointer",
                        expanded ? "bg-primary/[0.04] hover:bg-primary/[0.06]" : undefined
                      )}
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                    >
                      <TableCell className="pr-0 text-muted-foreground">
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={c.name} className="h-9 w-9 text-xs" />
                          <div className="min-w-0">
                            <p className="font-medium leading-tight truncate">{c.name}</p>
                            {c.address && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {c.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.email || c.phone ? (
                          <div className="space-y-0.5">
                            {c.email && (
                              <a
                                href={`mailto:${c.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-xs hover:underline"
                              >
                                <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="truncate">{c.email}</span>
                              </a>
                            )}
                            {c.phone && (
                              <a
                                href={`tel:${c.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-xs hover:underline"
                              >
                                <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                                {c.phone}
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {c.vatNumber ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                            c.quotes.length > 0
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <FileText className="h-3 w-3" />
                          {c.quotes.length}
                        </span>
                        {value > 0 && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                            {formatCurrency(value)} acc.
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {last ? (
                          <Link
                            href={`/preventivi/${last.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="group block min-w-0"
                          >
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium group-hover:underline">
                                {last.title}
                              </span>
                              <StatusBadge status={last.status} />
                            </span>
                            <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                              {last.code} · {formatDate(last.createdAt)}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {perms.manageClients && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label="Modifica cliente"
                              onClick={() => openEdit(c)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              aria-label="Elimina cliente"
                              onClick={() => deleteClient(c)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>

                    {expanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={perms.manageClients ? 7 : 6}
                          className="bg-muted/20 p-4"
                        >
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Preventivi di {c.name}
                          </p>
                          <QuoteList quotes={c.quotes} />
                          {c.notes && (
                            <p className="mt-3 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Note: </span>
                              {c.notes}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Lista mobile ── */}
      <div className="lg:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <Building2 className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-medium text-foreground">
              {search ? "Nessun cliente trovato" : "Nessun cliente ancora"}
            </p>
            {!search && perms.manageClients && (
              <p className="text-sm">Tocca + in alto per aggiungerne uno</p>
            )}
          </div>
        ) : (
          filtered.map((c) => {
            const last = c.quotes[0];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setDetail(c)}
                className="w-full rounded-2xl border bg-card p-3.5 text-left shadow-xs transition-all active:scale-[.98] active:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} className="h-11 w-11 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight truncate">{c.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {c.email && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </span>
                      )}
                      {c.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 shrink-0" />
                          {c.phone}
                        </span>
                      )}
                      {!c.email && !c.phone && c.vatNumber && (
                        <span className="font-mono">{c.vatNumber}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold tabular-nums",
                      c.quotes.length > 0
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <FileText className="h-3 w-3" />
                    {c.quotes.length}
                  </span>
                </div>

                {last && (
                  <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-muted/50 px-2.5 py-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {last.title}
                    </span>
                    <StatusBadge status={last.status} />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* ── Scheda cliente (mobile) ── */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar name={detail.name} className="h-12 w-12 text-base" />
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-left">{detail.name}</DialogTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cliente dal {formatDate(detail.createdAt)}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <SummaryTile
                    label="Preventivi"
                    value={String(detail.quotes.length)}
                  />
                  <SummaryTile
                    label="Valore accettato"
                    value={formatCurrency(acceptedValue(detail.quotes))}
                  />
                </div>

                <div className="space-y-1.5">
                  {detail.email && (
                    <DetailRow icon={Mail} href={`mailto:${detail.email}`} text={detail.email} />
                  )}
                  {detail.phone && (
                    <DetailRow icon={Phone} href={`tel:${detail.phone}`} text={detail.phone} />
                  )}
                  {detail.address && <DetailRow icon={MapPin} text={detail.address} />}
                  {detail.vatNumber && (
                    <DetailRow icon={Hash} text={detail.vatNumber} mono />
                  )}
                </div>

                {detail.notes && (
                  <p className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Note: </span>
                    {detail.notes}
                  </p>
                )}

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Preventivi collegati
                  </p>
                  <QuoteList quotes={detail.quotes} onNavigate={() => setDetail(null)} />
                </div>
              </div>

              {perms.manageClients && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-destructive hover:text-destructive sm:w-auto"
                    onClick={() => deleteClient(detail)}
                  >
                    <Trash2 className="h-4 w-4" /> Elimina
                  </Button>
                  <Button
                    className="w-full gap-2 sm:w-auto"
                    onClick={() => {
                      const c = detail;
                      setDetail(null);
                      openEdit(c);
                    }}
                  >
                    <Edit2 className="h-4 w-4" /> Modifica
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Form nuovo/modifica ── */}
      <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica cliente" : "Nuovo cliente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome / Ragione sociale *</Label>
              <Input {...register("name")} placeholder="Mario Rossi Srl" />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>P.IVA / CF</Label>
                <Input {...register("vatNumber")} placeholder="IT..." className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefono</Label>
                <Input {...register("phone")} type="tel" inputMode="tel" placeholder="+39 ..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                {...register("email")}
                type="email"
                inputMode="email"
                placeholder="cliente@email.com"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Indirizzo</Label>
              <Input {...register("address")} placeholder="Via Roma 1, 10100 Torino" />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea {...register("notes")} rows={2} placeholder="Note interne..." />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="w-full sm:w-auto"
              >
                Annulla
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Aggiorna" : "Crea cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sotto-componenti ────────────────────────────────────────────────────────

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs">
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  text,
  href,
  mono,
}: {
  icon: React.ElementType;
  text: string;
  href?: string;
  mono?: boolean;
}) {
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className={cn("min-w-0 flex-1 truncate", mono && "font-mono text-xs")}>
        {text}
      </span>
      {href && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );

  const className =
    "flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-sm";

  return href ? (
    <a href={href} className={cn(className, "transition-colors active:bg-accent")}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}
