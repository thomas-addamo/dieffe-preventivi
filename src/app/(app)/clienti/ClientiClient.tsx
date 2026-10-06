"use client";

import { useMemo, useState } from "react";
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
import { Page, PageHeader, EmptyState } from "@/components/shared/Page";

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
    <Page>
      <PageHeader
        title="Clienti"
        subtitle={`${clients.length} client${clients.length === 1 ? "e" : "i"} · ${totalQuotes} preventiv${
          totalQuotes === 1 ? "o" : "i"
        } collegat${totalQuotes === 1 ? "o" : "i"}`}
        actions={
          perms.manageClients && (
            <>
              <Button onClick={openNew} className="hidden gap-2 lg:flex">
                <Plus className="h-4 w-4" /> Nuovo cliente
              </Button>
              <button
                onClick={openNew}
                aria-label="Nuovo cliente"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition-transform active:scale-90 lg:hidden"
              >
                <Plus className="h-5 w-5" />
              </button>
            </>
          )
        }
      />

      {/* Riepilogo rapido */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryTile label="Clienti" value={String(clients.length)} />
        <SummaryTile label="Preventivi" value={String(totalQuotes)} />
        <SummaryTile
          label="Valore accettato"
          value={formatCurrency(totalAccepted)}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Ricerca + ordinamento */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, email, P.IVA o preventivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="shrink-0 sm:w-56">
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

      {/* ── Elenco compatto (stesso su desktop e mobile) ── */}
      {filtered.length === 0 ? (
        <div className="surface p-0">
          <EmptyState
            icon={Building2}
            title={search ? "Nessun cliente trovato" : "Nessun cliente ancora"}
            description={
              !search && perms.manageClients ? "Aggiungi il primo cliente con il pulsante +." : undefined
            }
          />
        </div>
      ) : (
        <div className="surface divide-y overflow-hidden p-0">
          {filtered.map((c) => {
            const last = c.quotes[0];
            const value = acceptedValue(c.quotes);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setDetail(c)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 active:bg-accent"
              >
                <Avatar name={c.name} className="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold leading-tight">{c.name}</p>
                  <div className="mt-0.5 flex min-w-0 items-center gap-x-3 text-xs text-muted-foreground">
                    {c.email && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </span>
                    )}
                    {c.phone && (
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </span>
                    )}
                    {!c.email && !c.phone && (
                      <span className="truncate">{c.address || c.vatNumber || "Nessun contatto"}</span>
                    )}
                  </div>
                </div>

                {/* Ultimo preventivo: solo dove c'è spazio */}
                {last && (
                  <div className="hidden w-64 min-w-0 shrink-0 items-center gap-2 md:flex">
                    <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
                      {last.title}
                    </span>
                    <StatusBadge status={last.status} />
                  </div>
                )}

                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      c.quotes.length > 0
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <FileText className="h-3 w-3" />
                    {c.quotes.length}
                  </span>
                  {value > 0 && (
                    <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:block">
                      {formatCurrency(value)}
                    </span>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </button>
            );
          })}
        </div>
      )}

      {/* ── Scheda cliente ── */}
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
                    nested
                    label="Preventivi"
                    value={String(detail.quotes.length)}
                  />
                  <SummaryTile
                    nested
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
                  <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
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
    </Page>
  );
}

// ─── Sotto-componenti ────────────────────────────────────────────────────────

/** `nested`: dentro una finestra (padding 20 → raggio 12), altrimenti card. */
function SummaryTile({
  label,
  value,
  nested,
  className,
}: {
  label: string;
  value: string;
  nested?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(nested ? "rounded-lg border bg-card p-3" : "surface", className)}>
      <p className="truncate text-xs leading-tight text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-bold tabular-nums sm:text-lg md:text-xl">{value}</p>
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
    "flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm";

  return href ? (
    <a href={href} className={cn(className, "transition-colors active:bg-accent")}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}
