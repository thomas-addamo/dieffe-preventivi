"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, Check, ChevronDown, ChevronUp, Loader2, MapPin, Percent, Plus, Search, User, X } from "lucide-react";
import { useAutoCorrect } from "@/hooks/use-auto-correct";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { QuoteWithRelations } from "@/types";
import { usePermissions } from "@/hooks/use-permissions";
import { QUOTE_STATUS_COLORS, QUOTE_STATUS_LABELS, cn } from "@/lib/utils";
import { notesVatMismatch, validityInfo } from "./quote-header-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Intestazione del preventivo (C3): titolo grande, codice e stato, quattro
// riquadri (cliente, cantiere, validità, IVA) e note generali. Tutto si
// modifica sul posto; in sola lettura (viewer o preventivo bloccato) resta
// solo da leggere. Il cliente si sceglie da una tendina con ricerca, dove si
// può anche crearne uno nuovo.
// ─────────────────────────────────────────────────────────────────────────────

interface QuoteHeaderFormProps {
  quote: QuoteWithRelations;
  clients: { id: string; name: string }[];
  onChange: (patch: Partial<QuoteWithRelations>) => void;
}

const VAT_LABEL: Record<number, string> = { 0: "Esente (0%)", 4: "Ridotta (4%)", 10: "Agevolata (10%)", 22: "Ordinaria (22%)" };

const dt = (iso: string | Date | null | undefined) =>
  iso ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)) : "";

function Tile({ icon: Icon, label, children, tone }: { icon: React.ElementType; label: string; children: React.ReactNode; tone?: "warn" | "bad" }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-2xl border p-3.5",
        tone === "warn" && "border-orange-200 bg-orange-50/60 dark:border-orange-900/60 dark:bg-orange-950/20",
        tone === "bad" && "border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20"
      )}
    >
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      {children}
    </div>
  );
}

const linkCls = "text-[13px] font-medium text-primary hover:underline disabled:opacity-50";

function ClientPicker({
  value,
  clients,
  onPick,
  disabled,
}: {
  value: string | null;
  clients: { id: string; name: string }[];
  onPick: (id: string | null) => void;
  disabled: boolean;
}) {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [created, setCreated] = useState<{ id: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const all = useMemo(
    () => [...clients, ...created.filter((c) => !clients.some((x) => x.id === c.id))].sort((a, b) => a.name.localeCompare(b.name, "it")),
    [clients, created]
  );
  const current = all.find((c) => c.id === value) ?? null;
  const needle = q.trim().toLowerCase();
  const list = needle ? all.filter((c) => c.name.toLowerCase().includes(needle)) : all;
  const canCreate = can.manageClients && needle.length > 1 && !all.some((c) => c.name.toLowerCase() === needle);
  // Voci navigabili da tastiera: "Nessun cliente" (senza ricerca), i clienti, "Crea".
  const rows: ({ kind: "none" } | { kind: "client"; c: { id: string; name: string } } | { kind: "create" })[] = [
    ...(needle ? [] : [{ kind: "none" as const }]),
    ...list.map((c) => ({ kind: "client" as const, c })),
    ...(canCreate ? [{ kind: "create" as const }] : []),
  ];

  async function create() {
    const name = q.trim();
    setCreating(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      const c = (await res.json()) as { id: string; name: string };
      setCreated((x) => [...x, { id: c.id, name: c.name }]);
      onPick(c.id);
      setOpen(false);
      toast.success(`Cliente «${c.name}» creato`, { action: { label: "Completa la scheda", onClick: () => window.open(`/clienti?apri=${c.id}`, "_self") } });
    } catch {
      toast.error("Cliente non creato");
    } finally {
      setCreating(false);
    }
  }

  function choose(i: number) {
    const r = rows[i];
    if (!r) return;
    if (r.kind === "create") return void create();
    onPick(r.kind === "none" ? null : r.c.id);
    setOpen(false);
  }

  if (disabled) return <span className="truncate text-[15px] font-semibold">{current?.name ?? "Nessun cliente"}</span>;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setQ("");
          setActive(0);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="-mx-1.5 flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-left text-[15px] font-semibold transition-colors hover:bg-accent"
        >
          <span className={cn("truncate", !current && "text-muted-foreground")}>{current?.name ?? "Scegli il cliente"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(rows.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(active);
              }
            }}
            placeholder="Cerca o crea un cliente…"
            aria-label="Cerca cliente"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {rows.length === 0 && <p className="px-3 py-4 text-center text-sm text-muted-foreground">Nessun cliente trovato</p>}
          {rows.map((r, i) => {
            const selected = r.kind === "client" ? r.c.id === value : r.kind === "none" ? !value : false;
            return (
              <button
                key={r.kind === "client" ? r.c.id : r.kind}
                type="button"
                onMouseMove={() => active !== i && setActive(i)}
                onClick={() => choose(i)}
                disabled={r.kind === "create" && creating}
                className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm", i === active && "bg-accent")}
              >
                {r.kind === "create" ? (
                  <>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
                    <span className="truncate font-medium text-primary">Crea «{q.trim()}»</span>
                  </>
                ) : (
                  <>
                    <span className={cn("min-w-0 flex-1 truncate", r.kind === "none" && "text-muted-foreground")}>
                      {r.kind === "none" ? "Nessun cliente" : r.c.name}
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function QuoteHeaderForm({ quote, clients, onChange }: QuoteHeaderFormProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const { isViewer } = usePermissions();
  // Correzione automatica (B2) di titolo e note generali.
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  useAutoCorrect({ pref: "autoCorrectTitle", label: "Titolo", value: quote.title, onChange: (title) => onChange({ title }), inputRef: titleRef, disabled: isViewer });
  useAutoCorrect({ pref: "autoCorrectNotes", label: "Note", value: quote.notes, onChange: (notes) => onChange({ notes }), inputRef: notesRef, disabled: isViewer });

  const validity = validityInfo(quote.validUntil);
  const vatWarning = notesVatMismatch(quote.notes, quote.vatRate);
  const address = quote.projectAddress?.trim() ?? "";
  const setValidity = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    onChange({ validUntil: d.toISOString().slice(0, 10) });
  };

  return (
    <div className="surface overflow-hidden p-0">
      <div className="flex items-start gap-3 px-4 pt-4 md:px-5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[12px] text-foreground/80">{quote.code}</span>
          <span className={cn("rounded-full px-2 py-0.5 font-semibold", QUOTE_STATUS_COLORS[quote.status])}>
            {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
          </span>
          <span className="text-muted-foreground">
            Creato il {dt(quote.createdAt)}
            {quote.author?.name ? ` da ${quote.author.name}` : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Mostra l'intestazione" : "Comprimi l'intestazione"}
          className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      <div className="px-4 pb-4 pt-1.5 md:px-5">
        <label className="sr-only" htmlFor="quote-title">Titolo del preventivo</label>
        <input
          id="quote-title"
          ref={titleRef}
          value={quote.title}
          onChange={(e) => onChange({ title: e.target.value })}
          readOnly={isViewer}
          placeholder="Titolo del preventivo (es. Ristrutturazione appartamento via Roma)"
          className={cn(
            "-mx-2 w-[calc(100%+1rem)] rounded-lg border border-transparent bg-transparent px-2 py-1 text-[22px] font-bold leading-tight tracking-tight outline-none transition-colors placeholder:font-medium placeholder:text-muted-foreground/70 md:text-[26px]",
            !isViewer && "hover:border-border focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/15"
          )}
        />
        {collapsed && (
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {[clients.find((c) => c.id === quote.clientId)?.name, address].filter(Boolean).join(" · ") || "Nessun cliente"}
          </p>
        )}
      </div>

      {!collapsed && (
        <div className="space-y-4 border-t px-4 pb-4 pt-4 md:px-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile icon={User} label="Cliente">
              <ClientPicker value={quote.clientId} clients={clients} onPick={(id) => onChange({ clientId: id })} disabled={isViewer} />
              {quote.clientId && (
                <Link href={`/clienti?apri=${quote.clientId}`} className={linkCls}>
                  Scheda cliente
                </Link>
              )}
            </Tile>

            <Tile icon={MapPin} label="Cantiere">
              <Input
                value={quote.projectAddress ?? ""}
                onChange={(e) => onChange({ projectAddress: e.target.value })}
                readOnly={isViewer}
                placeholder="Via e numero civico, città"
                aria-label="Indirizzo del cantiere"
                className="h-9 rounded-lg px-2.5 text-[15px] font-semibold"
              />
              {address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={linkCls}
                >
                  Apri nella mappa
                </a>
              )}
            </Tile>

            <Tile icon={CalendarDays} label="Validità" tone={validity.tone}>
              {editingDate || (quote.validUntil && !isViewer) ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    value={quote.validUntil ?? ""}
                    onChange={(e) => onChange({ validUntil: e.target.value || null })}
                    readOnly={isViewer}
                    aria-label="Valido fino al"
                    autoFocus={editingDate && !quote.validUntil}
                    onBlur={() => setEditingDate(false)}
                    className="h-9 rounded-lg px-2.5 text-[15px] font-semibold"
                  />
                  {quote.validUntil && !isViewer && (
                    <button type="button" onClick={() => onChange({ validUntil: null })} aria-label="Togli la validità"
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <span className={cn("text-[15px] font-semibold", !quote.validUntil && "text-orange-800 dark:text-orange-300")}>
                  {quote.validUntil ? dt(quote.validUntil) : "Non impostata"}
                </span>
              )}
              {validity.text && <span className={cn("text-xs", validity.textClass)}>{validity.text}</span>}
              {!isViewer && (
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  <button type="button" className={linkCls} onClick={() => setValidity(30)}>30 giorni</button>
                  <button type="button" className={linkCls} onClick={() => setValidity(60)}>60 giorni</button>
                  {!quote.validUntil && (
                    <button type="button" className={linkCls} onClick={() => setEditingDate(true)}>Scegli data</button>
                  )}
                </span>
              )}
            </Tile>

            <Tile icon={Percent} label="IVA">
              {isViewer ? (
                <span className="text-[15px] font-semibold">{VAT_LABEL[quote.vatRate] ?? `${quote.vatRate}%`}</span>
              ) : (
                <Select value={String(quote.vatRate)} onValueChange={(v) => onChange({ vatRate: Number(v) })}>
                  <SelectTrigger aria-label="Aliquota IVA" className="h-9 rounded-lg px-2.5 text-[15px] font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VAT_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Tile>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="quote-notes" className="text-xs text-muted-foreground">
              Note generali (stampate in fondo al preventivo)
            </label>
            <Textarea
              id="quote-notes"
              ref={notesRef}
              value={quote.notes ?? ""}
              onChange={(e) => onChange({ notes: e.target.value })}
              readOnly={isViewer}
              placeholder="Es. detrazioni applicabili, condizioni, esclusioni…"
              rows={3}
              className="bg-muted/30"
            />
            {vatWarning && <p className="text-xs text-amber-700 dark:text-amber-400">{vatWarning}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
