"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  MoreVertical,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TotalsPanel } from "./TotalsPanel";
import { QuoteHeaderForm } from "./QuoteHeaderForm";
import type { QuoteWithRelations, SectionWithItems, ItemWithImages } from "@/types";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS, generateId, formatCurrency } from "@/lib/utils";
import { calcQuoteTotals } from "@/lib/calculations";
import { usePermissions } from "@/hooks/use-permissions";

// ─── Skeleton shown while SectionsDragList bundle loads ──────────────────────

function SectionsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

// ─── Dynamic import: disables SSR for all dnd-kit code ───────────────────────
// dnd-kit generates non-deterministic aria IDs that differ between SSR and
// client, causing hydration mismatches. Loading client-only fixes this.

const SectionsDragList = dynamic(
  () => import("./SectionsDragList").then((m) => m.SectionsDragList),
  { ssr: false, loading: () => <SectionsSkeleton /> }
);

// ─────────────────────────────────────────────────────────────────────────────

interface QuoteEditorProps {
  initialQuote: QuoteWithRelations;
  clients: { id: string; name: string }[];
}

const SECTION_CODES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function QuoteEditor({ initialQuote, clients }: QuoteEditorProps) {
  const router = useRouter();
  const { isViewer, can: perms } = usePermissions();
  const [quote, setQuote] = useState<QuoteWithRelations>(initialQuote);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [mobileTotalsOpen, setMobileTotalsOpen] = useState(false);
  const [readonlyBannerDismissed, setReadonlyBannerDismissed] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracks section IDs currently being deleted, so performSave won't
  // re-insert them if a stale debounce fires concurrently with the DELETE.
  const deletedSectionIdsRef = useRef<Set<string>>(new Set());

  const scheduleSave = useCallback(
    (updatedQuote: QuoteWithRelations) => {
      if (isViewer) return;
      setSaveState("unsaved");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        performSave(updatedQuote);
      }, 1200);
    },
    [isViewer]
  );

  async function performSave(q: QuoteWithRelations) {
    setSaveState("saving");
    try {
      await fetch(`/api/quotes/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: q.title,
          clientId: q.clientId,
          projectAddress: q.projectAddress,
          vatRate: q.vatRate,
          discountType: q.discountType,
          discountValue: q.discountValue,
          notes: q.notes,
          paymentTerms: q.paymentTerms,
          validUntil: q.validUntil,
        }),
      });

      for (const section of q.sections) {
        // Guard against race condition: skip sections with a pending DELETE
        // to prevent re-inserting them in the DB right after they were deleted.
        if (deletedSectionIdsRef.current.has(section.id)) continue;

        await fetch(`/api/quotes/${q.id}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: section.id,
            code: section.code,
            title: section.title,
            description: section.description,
            orderIndex: section.orderIndex,
            sectionNote: section.sectionNote,
            isOptional: section.isOptional,
            isOptionalIncluded: section.isOptionalIncluded,
          }),
        });

        for (const item of section.items) {
          await fetch(`/api/quotes/${q.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: item.id,
              sectionId: section.id,
              description: item.description,
              unitOfMeasure: item.unitOfMeasure,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              notes: item.notes,
              orderIndex: item.orderIndex,
            }),
          });
        }
      }

      setSaveState("saved");
    } catch {
      setSaveState("unsaved");
      toast.error("Errore durante il salvataggio");
    }
  }

  function updateQuote(patch: Partial<QuoteWithRelations>) {
    setQuote((prev) => {
      const updated = { ...prev, ...patch };
      scheduleSave(updated);
      return updated;
    });
  }

  function addSection(isOptional = false) {
    const usedCodes = new Set(quote.sections.map((s) => s.code));
    const code =
      SECTION_CODES.find((c) => !usedCodes.has(c)) ??
      String(quote.sections.length + 1);

    const newSection: SectionWithItems = {
      id: generateId(),
      quoteId: quote.id,
      code,
      title: isOptional ? "Nuova sezione opzionale" : "Nuova sezione",
      description: null,
      sectionNote: null,
      orderIndex: quote.sections.length,
      isOptional,
      isOptionalIncluded: false,
      items: [],
    };

    updateQuote({ sections: [...quote.sections, newSection] });
  }

  function updateSection(sectionId: string, patch: Partial<SectionWithItems>) {
    updateQuote({
      sections: quote.sections.map((s) =>
        s.id === sectionId ? { ...s, ...patch } : s
      ),
    });
  }

  async function deleteSection(sectionId: string) {
    // Mark as pending delete BEFORE any state update.
    // performSave will skip this ID if it races with the DELETE API call.
    deletedSectionIdsRef.current.add(sectionId);

    // Optimistic UI update + schedule save for remaining sections.
    updateQuote({
      sections: quote.sections.filter((s) => s.id !== sectionId),
    });

    try {
      const res = await fetch(
        `/api/quotes/${quote.id}/sections/${sectionId}`,
        { method: "DELETE" }
      );
      if (!res.ok) toast.error("Errore eliminazione sezione");
    } catch {
      toast.error("Errore eliminazione sezione");
    } finally {
      // Safe to unmark once DELETE is confirmed (or failed).
      deletedSectionIdsRef.current.delete(sectionId);
    }
  }

  function handleSectionsReordered(reordered: SectionWithItems[]) {
    setQuote((prev) => ({ ...prev, sections: reordered }));
    fetch(`/api/quotes/${quote.id}/sections/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reordered.map((s) => ({ id: s.id, orderIndex: s.orderIndex }))),
    }).catch(() => toast.error("Errore salvataggio ordine sezioni"));
  }

  function addItem(sectionId: string) {
    const section = quote.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const newItem: ItemWithImages = {
      id: generateId(),
      sectionId,
      description: "",
      unitOfMeasure: "n°",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      total: 0,
      notes: null,
      orderIndex: section.items.length,
      images: [],
    };

    updateSection(sectionId, { items: [...section.items, newItem] });
  }

  function updateItem(sectionId: string, itemId: string, patch: Partial<ItemWithImages>) {
    const section = quote.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const updatedItems = section.items.map((item) => {
      if (item.id !== itemId) return item;
      const updated = { ...item, ...patch };
      const qty = updated.quantity ?? 0;
      const price = updated.unitPrice ?? 0;
      const disc = updated.discount ?? 0;
      updated.total = qty * price * (1 - disc / 100);
      return updated;
    });

    updateSection(sectionId, { items: updatedItems });
  }

  function deleteItem(sectionId: string, itemId: string) {
    const section = quote.sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      items: section.items.filter((i) => i.id !== itemId),
    });
    fetch(`/api/quotes/${quote.id}/items/${itemId}`, { method: "DELETE" })
      .catch(() => toast.error("Errore eliminazione voce"));
  }

  function duplicateItem(sectionId: string, itemId: string) {
    const section = quote.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const orig = section.items.find((i) => i.id === itemId);
    if (!orig) return;
    const dup: ItemWithImages = {
      ...orig,
      id: generateId(),
      orderIndex: orig.orderIndex + 0.5,
      images: [],
    };
    const items = [...section.items, dup].sort(
      (a, b) => a.orderIndex - b.orderIndex
    );
    updateSection(sectionId, { items });
  }

  function toggleOptionalIncluded(sectionId: string, value: boolean) {
    if (isViewer) return;
    setQuote((prev) => {
      const updated = {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, isOptionalIncluded: value } : s
        ),
      };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      performSave(updated);
      return updated;
    });
  }

  async function changeStatus(status: string) {
    const res = await fetch(`/api/quotes/${quote.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setQuote((prev) => ({ ...prev, status: status as never }));
      toast.success("Stato aggiornato");
    } else {
      toast.error("Errore durante l'aggiornamento dello stato");
    }
  }

  async function deleteQuote() {
    if (!confirm("Eliminare questo preventivo? L'operazione non può essere annullata."))
      return;
    const res = await fetch(`/api/quotes/${quote.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Preventivo eliminato");
      router.push("/dashboard");
    }
  }

  async function exportQuote(format: string) {
    const url = `/api/export/${format}/${quote.id}`;
    if (format === "pdf") {
      window.open(url, "_blank");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.click();
  }

  const totals = calcQuoteTotals(
    quote.sections,
    quote.vatRate,
    quote.discountType,
    quote.discountValue
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        performSave(quote);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [quote]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Read-only banner */}
      {isViewer && !readonlyBannerDismissed && (
        <div className="bg-muted/60 border-b px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Modalità sola lettura — non hai i permessi per modificare questo preventivo.</span>
          <button
            className="ml-auto text-xs underline hover:text-foreground"
            onClick={() => setReadonlyBannerDismissed(true)}
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-background border-b px-3 md:px-6 py-2.5 flex items-center gap-2 md:gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground px-2"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Button>

        <div className="w-px h-4 bg-border" />

        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-sm truncate">{quote.code}</h1>
        </div>

        {!isViewer && (
          <span className="hidden sm:block text-xs text-muted-foreground shrink-0">
            {saveState === "saving"
              ? "Salvataggio..."
              : saveState === "saved"
              ? "✓ Salvato"
              : "Non salvato"}
          </span>
        )}

        {perms.changeQuoteStatus ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 px-2 md:px-3">
                <Badge
                  variant="secondary"
                  className={`text-xs ${QUOTE_STATUS_COLORS[quote.status]}`}
                >
                  {QUOTE_STATUS_LABELS[quote.status]}
                </Badge>
                <ChevronDown className="w-3 h-3 hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(QUOTE_STATUS_LABELS).map(([k, v]) => (
                <DropdownMenuItem key={k} onClick={() => changeStatus(k)}>
                  {v}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Badge
            variant="secondary"
            className={`text-xs ${QUOTE_STATUS_COLORS[quote.status]}`}
          >
            {QUOTE_STATUS_LABELS[quote.status]}
          </Badge>
        )}

        <div className="hidden md:flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" /> Esporta
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportQuote("pdf")}>PDF</DropdownMenuItem>
              {perms.exportQuoteAdvanced && (
                <>
                  <DropdownMenuItem onClick={() => exportQuote("excel")}>Excel (.xlsx)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportQuote("csv")}>CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportQuote("json")}>JSON (backup)</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {perms.deleteQuote && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={deleteQuote}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportQuote("pdf")}>
              <Download className="w-3.5 h-3.5 mr-2" /> Apri PDF
            </DropdownMenuItem>
            {perms.exportQuoteAdvanced && (
              <DropdownMenuItem onClick={() => exportQuote("excel")}>
                <Download className="w-3.5 h-3.5 mr-2" /> Excel
              </DropdownMenuItem>
            )}
            {perms.deleteQuote && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={deleteQuote}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Elimina preventivo
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main content */}
      <div className="flex flex-1 gap-0 min-h-0">
        {/* Editor column */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <div className="max-w-4xl mx-auto p-3 md:p-6 space-y-4 md:space-y-6">
            <QuoteHeaderForm
              quote={quote}
              clients={clients}
              onChange={(patch) => updateQuote(patch)}
            />

            {/* Sections — loaded client-only to avoid dnd-kit hydration mismatch */}
            <SectionsDragList
              sections={quote.sections}
              quoteId={quote.id}
              onSectionsReordered={handleSectionsReordered}
              onUpdateSection={updateSection}
              onDeleteSection={deleteSection}
              onAddItem={addItem}
              onUpdateItem={updateItem}
              onDeleteItem={deleteItem}
              onDuplicateItem={duplicateItem}
              onToggleOptionalIncluded={toggleOptionalIncluded}
              onAddSection={addSection}
            />
          </div>
        </div>

        {/* Desktop totals panel */}
        <div className="hidden md:block w-72 shrink-0 border-l overflow-y-auto">
          <div className="sticky top-0 p-4">
            <TotalsPanel
              sections={quote.sections}
              vatRate={quote.vatRate}
              discountType={quote.discountType}
              discountValue={quote.discountValue}
              paymentTerms={quote.paymentTerms}
              totals={totals}
              onChangeVat={(rate) => updateQuote({ vatRate: rate })}
              onChangeDiscount={(type, value) =>
                updateQuote({ discountType: type, discountValue: value })
              }
              onChangePaymentTerms={(terms) => updateQuote({ paymentTerms: terms })}
              onToggleOptionalIncluded={toggleOptionalIncluded}
            />
          </div>
        </div>
      </div>

      {/* Mobile totals bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30">
        {mobileTotalsOpen && (
          <div className="fixed inset-0 z-20 flex flex-col justify-end">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileTotalsOpen(false)}
            />
            <div className="relative bg-background rounded-t-2xl max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-background px-5 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold">Riepilogo preventivo</h3>
                <button onClick={() => setMobileTotalsOpen(false)}>
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 pb-8">
                <TotalsPanel
                  sections={quote.sections}
                  vatRate={quote.vatRate}
                  discountType={quote.discountType}
                  discountValue={quote.discountValue}
                  paymentTerms={quote.paymentTerms}
                  totals={totals}
                  onChangeVat={(rate) => updateQuote({ vatRate: rate })}
                  onChangeDiscount={(type, value) =>
                    updateQuote({ discountType: type, discountValue: value })
                  }
                  onChangePaymentTerms={(terms) => updateQuote({ paymentTerms: terms })}
                  onToggleOptionalIncluded={toggleOptionalIncluded}
                />
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setMobileTotalsOpen(true)}
          className="w-full bg-background border-t px-5 py-3 flex items-center justify-between shadow-lg"
        >
          <div className="text-left">
            <p className="text-xs text-muted-foreground">Totale</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(totals.total)}</p>
          </div>
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
