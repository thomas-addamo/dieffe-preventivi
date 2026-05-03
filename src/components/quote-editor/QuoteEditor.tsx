"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Save,
  Copy,
  Trash2,
  Download,
  ChevronDown,
  Plus,
  ArrowLeft,
  CheckCircle,
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
import { SectionBlock } from "./SectionBlock";
import { TotalsPanel } from "./TotalsPanel";
import { QuoteHeaderForm } from "./QuoteHeaderForm";
import type { QuoteWithRelations, SectionWithItems, ItemWithImages } from "@/types";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS, generateId } from "@/lib/utils";
import { calcQuoteTotals } from "@/lib/calculations";

interface QuoteEditorProps {
  initialQuote: QuoteWithRelations;
  clients: { id: string; name: string }[];
}

const SECTION_CODES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function useDebouncedSave(
  quoteId: string,
  onSave: () => void,
  delay = 1200
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  const trigger = useCallback(() => {
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaving(true);
      onSave();
      setSaving(false);
      setSaved(true);
    }, delay);
  }, [delay, onSave]);

  return { trigger, saving, saved };
}

export function QuoteEditor({ initialQuote, clients }: QuoteEditorProps) {
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteWithRelations>(initialQuote);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (updatedQuote: QuoteWithRelations) => {
      setSaveState("unsaved");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        performSave(updatedQuote);
      }, 1200);
    },
    []
  );

  async function performSave(q: QuoteWithRelations) {
    setSaveState("saving");
    try {
      // save header
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

      // save sections
      for (const section of q.sections) {
        await fetch(`/api/quotes/${q.id}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: section.id,
            code: section.code,
            title: section.title,
            description: section.description,
            orderIndex: section.orderIndex,
          }),
        });

        // save items
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

  function addSection() {
    const usedCodes = new Set(quote.sections.map((s) => s.code));
    const code =
      SECTION_CODES.find((c) => !usedCodes.has(c)) ??
      String(quote.sections.length + 1);

    const newSection: SectionWithItems = {
      id: generateId(),
      quoteId: quote.id,
      code,
      title: "Nuova sezione",
      description: null,
      orderIndex: quote.sections.length,
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

  function deleteSection(sectionId: string) {
    updateQuote({
      sections: quote.sections.filter((s) => s.id !== sectionId),
    });
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

  function updateItem(
    sectionId: string,
    itemId: string,
    patch: Partial<ItemWithImages>
  ) {
    const section = quote.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const updatedItems = section.items.map((item) => {
      if (item.id !== itemId) return item;
      const updated = { ...item, ...patch };
      // recalculate total
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
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }
        performSave(quote);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [quote]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-2.5 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Button>

        <div className="w-px h-4 bg-border" />

        <div className="flex-1">
          <h1 className="font-semibold text-sm">{quote.code}</h1>
        </div>

        {/* Save state */}
        <span className="text-xs text-muted-foreground">
          {saveState === "saving"
            ? "Salvataggio..."
            : saveState === "saved"
            ? "✓ Salvato"
            : "Modifiche non salvate"}
        </span>

        {/* Status */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Badge
                variant="secondary"
                className={`text-xs ${QUOTE_STATUS_COLORS[quote.status]}`}
              >
                {QUOTE_STATUS_LABELS[quote.status]}
              </Badge>
              <ChevronDown className="w-3.5 h-3.5" />
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

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" /> Esporta
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportQuote("pdf")}>
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportQuote("excel")}>
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportQuote("csv")}>
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportQuote("json")}>
              JSON (backup)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={deleteQuote}
          title="Elimina preventivo"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 gap-0 min-h-0">
        {/* Editor column */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header form */}
            <QuoteHeaderForm
              quote={quote}
              clients={clients}
              onChange={(patch) => updateQuote(patch)}
            />

            {/* Sections */}
            <div className="space-y-4">
              {quote.sections.map((section, sIdx) => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  sectionIndex={sIdx}
                  quoteId={quote.id}
                  onUpdate={(patch) => updateSection(section.id, patch)}
                  onDelete={() => deleteSection(section.id)}
                  onAddItem={() => addItem(section.id)}
                  onUpdateItem={(itemId, patch) =>
                    updateItem(section.id, itemId, patch)
                  }
                  onDeleteItem={(itemId) => deleteItem(section.id, itemId)}
                  onDuplicateItem={(itemId) => duplicateItem(section.id, itemId)}
                />
              ))}

              <Button
                variant="outline"
                onClick={addSection}
                className="w-full gap-2 border-dashed text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-4 h-4" /> Aggiungi sezione
              </Button>
            </div>
          </div>
        </div>

        {/* Totals panel */}
        <div className="w-72 shrink-0 border-l overflow-y-auto">
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
              onChangePaymentTerms={(terms) =>
                updateQuote({ paymentTerms: terms })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
