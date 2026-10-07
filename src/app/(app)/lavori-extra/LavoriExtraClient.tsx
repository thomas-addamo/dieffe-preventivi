"use client";

import { useMenuParam } from "@/hooks/use-menu-param";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, FilePlus2, FileText, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, Page, PageHeader } from "@/components/shared/Page";
import { usePermissions } from "@/hooks/use-permissions";
import { cn, formatCurrency, formatDate, QUOTE_STATUS_COLORS, QUOTE_STATUS_LABELS } from "@/lib/utils";

// Lavori extra: per ogni preventivo, i preventivi separati di sole
// lavorazioni aggiuntive, con il loro importo isolato da quello principale.

export type ExtraQuote = {
  id: string;
  code: string;
  title: string;
  status: string;
  kind: "standard" | "extra";
  parentQuoteId: string | null;
  createdAt: string;
  clientName: string | null;
  total: number;
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        QUOTE_STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {QUOTE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function LavoriExtraClient({ quotes }: { quotes: ExtraQuote[] }) {
  const router = useRouter();
  const { can } = usePermissions();
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  useMenuParam("nuovo", () => can.createQuote && setPicker(true));

  const mains = useMemo(() => quotes.filter((q) => q.kind !== "extra"), [quotes]);
  const groups = useMemo(() => {
    const byParent = new Map<string, ExtraQuote[]>();
    for (const q of quotes) {
      if (q.kind === "extra" && q.parentQuoteId) {
        byParent.set(q.parentQuoteId, [...(byParent.get(q.parentQuoteId) ?? []), q]);
      }
    }
    return mains
      .filter((m) => byParent.has(m.id))
      .map((m) => {
        const extras = byParent.get(m.id)!.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return { main: m, extras, extrasTotal: extras.reduce((s, e) => s + e.total, 0) };
      });
  }, [quotes, mains]);

  const pickable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mains.filter(
      (m) =>
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        (m.clientName?.toLowerCase().includes(q) ?? false)
    );
  }, [mains, search]);

  async function createExtra(parentId: string) {
    setCreating(parentId);
    const res = await fetch(`/api/quotes/${parentId}/extras`, { method: "POST" });
    if (res.ok) {
      const { id } = await res.json();
      toast.success("Lavoro extra creato: aggiungi le lavorazioni");
      router.push(`/preventivi/${id}`);
    } else {
      toast.error("Impossibile creare il lavoro extra");
      setCreating(null);
    }
  }

  const totalExtras = groups.reduce((s, g) => s + g.extras.length, 0);

  return (
    <Page>
      <PageHeader
        title="Lavori extra"
        subtitle={`${totalExtras} lavor${totalExtras === 1 ? "o" : "i"} extra su ${groups.length} preventiv${groups.length === 1 ? "o" : "i"}`}
        actions={
          can.createQuote && (
            <Button className="gap-2" onClick={() => setPicker(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuovo lavoro extra</span>
            </Button>
          )
        }
      />

      {groups.length === 0 ? (
        <div className="surface p-0">
          <EmptyState
            icon={FilePlus2}
            title="Nessun lavoro extra"
            description="Quando un cliente chiede lavorazioni in più rispetto al preventivo, crea un lavoro extra: avrà le stesse intestazioni e un prezzo separato."
            action={
              can.createQuote && (
                <Button size="sm" className="mt-1 gap-1.5" onClick={() => setPicker(true)}>
                  <Plus className="h-3.5 w-3.5" /> Nuovo lavoro extra
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ main, extras, extrasTotal }) => (
            <section key={main.id} className="surface overflow-hidden p-0">
              {/* Preventivo principale */}
              <Link
                href={`/preventivi/${main.id}`}
                className="flex items-center gap-3 p-4 transition-colors hover:bg-accent/50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[11px] font-semibold text-primary">{main.code}</span>
                  <span className="block truncate text-[15px] font-semibold leading-snug">{main.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {main.clientName ?? "Nessun cliente"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[11px] text-muted-foreground">Preventivo</span>
                  <span className="block text-sm font-semibold tabular-nums">{formatCurrency(main.total)}</span>
                </span>
              </Link>

              {/* Extra: importo isolato */}
              <div className="divide-y border-t bg-amber-50/40 dark:bg-amber-950/10">
                {extras.map((x) => (
                  <Link
                    key={x.id}
                    href={`/preventivi/${x.id}`}
                    className="flex items-center gap-3 py-3 pl-6 pr-4 transition-colors hover:bg-amber-100/50 dark:hover:bg-amber-950/30 sm:pl-[68px]"
                  >
                    <FilePlus2 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          {x.code}
                        </span>
                        <StatusBadge status={x.status} />
                      </span>
                      <span className="block truncate text-sm font-medium">{x.title}</span>
                      <span className="block text-[11px] text-muted-foreground">{formatDate(x.createdAt)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(x.total)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  </Link>
                ))}
                <div className="flex items-center justify-between gap-3 py-3 pl-6 pr-4 sm:pl-[68px]">
                  {can.createQuote ? (
                    <button
                      type="button"
                      onClick={() => createExtra(main.id)}
                      disabled={creating === main.id}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:underline disabled:opacity-50 dark:text-amber-400"
                    >
                      {creating === main.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Aggiungi un altro extra
                    </button>
                  ) : (
                    <span />
                  )}
                  <span className="text-right text-xs text-muted-foreground">
                    Totale extra{" "}
                    <span className="ml-1 text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(extrasTotal)}
                    </span>
                  </span>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Scelta del preventivo */}
      <Dialog open={picker} onOpenChange={(o) => !o && setPicker(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuovo lavoro extra</DialogTitle>
            <DialogDescription>
              Scegli il preventivo a cui aggiungere lavorazioni extra. Cliente, cantiere e IVA vengono
              ripresi in automatico.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per titolo, codice o cliente..."
              className="pl-9"
            />
          </div>
          <div className="max-h-[50dvh] divide-y overflow-y-auto rounded-lg border">
            {pickable.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nessun preventivo trovato</p>
            ) : (
              pickable.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={!!creating}
                  onClick={() => createExtra(m.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[11px] text-primary">{m.code}</span>
                    <span className="block truncate text-sm font-medium">{m.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.clientName ?? "Nessun cliente"}
                    </span>
                  </span>
                  <StatusBadge status={m.status} />
                  {creating === m.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
