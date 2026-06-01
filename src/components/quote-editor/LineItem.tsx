"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  GripVertical,
  Copy,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  BookmarkPlus,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ImageUploader } from "./ImageUploader";
import type { ItemWithImages } from "@/types";
import type { PriceListItem } from "@/lib/db/schema";
import { UNIT_OF_MEASURES, formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";

interface AiSuggestion {
  unitOfMeasure: string;
  unitPrice: number;
  improvedDescription: string;
  confidence: "high" | "medium" | "low";
  matchedFromPriceList: boolean;
  notes?: string;
}

interface SaveToListinoModalProps {
  item: ItemWithImages;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}

function SaveToListinoModal({ item, categories, onClose, onSaved }: SaveToListinoModalProps) {
  const [form, setForm] = useState({
    description: item.description,
    unitOfMeasure: item.unitOfMeasure,
    unitPrice: String(item.unitPrice),
    category: "",
    code: "",
    notes: "",
    newCategory: "",
  });
  const [saving, setSaving] = useState(false);
  const [similar, setSimilar] = useState<PriceListItem[]>([]);

  useEffect(() => {
    fetch("/api/price-list/check-similar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: item.description }),
    })
      .then((r) => r.json())
      .then((d) => setSimilar(d.similar ?? []))
      .catch(() => {});
  }, [item.description]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/price-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: form.description,
        unitOfMeasure: form.unitOfMeasure,
        unitPrice: form.unitPrice,
        category: form.newCategory || form.category || null,
        code: form.code || null,
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Voce salvata nel listino");
      onSaved();
    } else {
      toast.error("Errore durante il salvataggio");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-sm">Salva nel listino prezzi</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-5 space-y-4">
          {similar.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <p className="font-medium">Attenzione: voci simili già nel listino:</p>
              {similar.map((s) => (
                <div key={s.id} className="pl-2">
                  &quot;{s.description}&quot; — €{s.unitPrice}/{s.unitOfMeasure}
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Descrizione</Label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">U.M.</Label>
              <Select
                value={form.unitOfMeasure}
                onValueChange={(v) => setForm({ ...form, unitOfMeasure: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OF_MEASURES.map((um) => (
                    <SelectItem key={um} value={um} className="text-xs">{um}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prezzo unitario</Label>
              <Input
                type="number"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                step="0.01"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select
              value={form.category || "_none"}
              onValueChange={(v) => setForm({ ...form, category: v === "_none" ? "" : v, newCategory: "" })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Seleziona..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nessuna</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Oppure: nuova categoria..."
              value={form.newCategory}
              onChange={(e) => setForm({ ...form, newCategory: e.target.value, category: "" })}
              className="h-8 text-xs mt-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Codice (opzionale)</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="CAP-001"
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>Annulla</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.description}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <BookmarkPlus className="w-3.5 h-3.5 mr-1" />}
            Salva nel listino
          </Button>
        </div>
      </div>
    </div>
  );
}

interface LineItemProps {
  item: ItemWithImages;
  itemNumber: string;
  quoteId: string;
  priceListItems?: PriceListItem[];
  onUpdate: (patch: Partial<ItemWithImages>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function LineItem({
  item,
  itemNumber,
  quoteId,
  priceListItems = [],
  onUpdate,
  onDelete,
  onDuplicate,
}: LineItemProps) {
  const [showImages, setShowImages] = useState(false);
  const { isViewer, can: perms } = usePermissions();
  const descDesktopRef = useRef<HTMLTextAreaElement>(null);
  const descMobileRef = useRef<HTMLTextAreaElement>(null);

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<PriceListItem[]>([]);

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiImproving, setAiImproving] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [suggestionIgnored, setSuggestionIgnored] = useState(false);
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save to listino
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [listinoCategories, setListinoCategories] = useState<string[]>([]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function autoResize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    autoResize(descDesktopRef.current);
    autoResize(descMobileRef.current);
  }, [item.description]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
    }
    if (e.key === "Escape") {
      setShowAutocomplete(false);
    }
  }

  // Autocomplete filtering
  function handleDescriptionChange(value: string) {
    onUpdate({ description: value });
    setSuggestionIgnored(false);
    setAiSuggestion(null);

    if (value.length >= 3 && priceListItems.length > 0) {
      const lower = value.toLowerCase();
      const words = lower.split(" ").filter((w) => w.length > 2);
      const matches = priceListItems.filter((p) => {
        const desc = p.description.toLowerCase();
        return words.some((w) => desc.includes(w));
      }).slice(0, 5);
      setAutocompleteItems(matches);
      setShowAutocomplete(matches.length > 0);
    } else {
      setShowAutocomplete(false);
    }

    // AI suggest debounce
    if (!isViewer) {
      scheduleAiSuggest(value);
    }
  }

  function applyFromListino(p: PriceListItem) {
    onUpdate({
      description: p.description,
      unitOfMeasure: p.unitOfMeasure,
      unitPrice: parseFloat(p.unitPrice),
    });
    setShowAutocomplete(false);
    setAiSuggestion(null);
  }

  function getAiEnabled() {
    try {
      return localStorage.getItem("ai_suggestions_enabled") !== "false";
    } catch {
      return true;
    }
  }

  const scheduleAiSuggest = useCallback(
    (description: string) => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
      if (description.length < 10 || !getAiEnabled()) return;
      // Don't trigger if U.M. and price already set
      if (item.unitPrice > 0 && item.unitOfMeasure !== "n°") return;

      aiDebounceRef.current = setTimeout(async () => {
        setAiLoading(true);
        try {
          const res = await fetch("/api/ai/suggest-price", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description }),
            signal: AbortSignal.timeout(9000),
          });
          if (!res.ok) return;
          const { suggestion } = await res.json();
          if (suggestion && (suggestion.confidence === "high" || suggestion.confidence === "medium")) {
            setAiSuggestion(suggestion);
          }
        } catch {
          // silent fallback
        } finally {
          setAiLoading(false);
        }
      }, 1500);
    },
    [item.unitPrice, item.unitOfMeasure]
  );

  async function handleAiImprove() {
    if (!item.description || item.description.length < 3) return;
    setAiImproving(true);
    try {
      const res = await fetch("/api/ai/improve-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: item.description }),
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) return;
      const { improvedDescription } = await res.json();
      if (improvedDescription) {
        onUpdate({ description: improvedDescription });
        toast.success("Descrizione migliorata dall'AI ✨");
      }
    } catch {
      // silent fallback
    } finally {
      setAiImproving(false);
    }
  }

  function applySuggestion() {
    if (!aiSuggestion) return;
    onUpdate({
      description: aiSuggestion.improvedDescription || item.description,
      unitOfMeasure: aiSuggestion.unitOfMeasure,
      unitPrice: aiSuggestion.unitPrice,
    });
    setAiSuggestion(null);
  }

  async function openSaveToListino() {
    const res = await fetch("/api/price-list/categories");
    if (res.ok) setListinoCategories(await res.json());
    setShowSaveModal(true);
  }

  const showAiBanner =
    !!aiSuggestion &&
    !suggestionIgnored &&
    !showAutocomplete &&
    !isViewer;

  const descriptionBlock = (ref: React.RefObject<HTMLTextAreaElement | null>, isMobile: boolean) => (
    <div className={isMobile ? "flex-1 relative" : "pt-0.5 relative"}>
      <div className={isMobile ? "flex items-start gap-1" : "flex items-start gap-1"}>
        <textarea
          ref={ref}
          value={item.description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
          onFocus={() => {
            if (item.description.length >= 3) {
              const lower = item.description.toLowerCase();
              const words = lower.split(" ").filter((w) => w.length > 2);
              const matches = priceListItems.filter((p) => {
                const desc = p.description.toLowerCase();
                return words.some((w) => desc.includes(w));
              }).slice(0, 5);
              if (matches.length > 0) {
                setAutocompleteItems(matches);
                setShowAutocomplete(true);
              }
            }
          }}
          readOnly={isViewer}
          placeholder="Descrizione voce..."
          rows={1}
          className={`flex-1 resize-none bg-transparent text-sm outline-none focus:outline-none placeholder:text-muted-foreground/60 overflow-hidden leading-5 py-1 ${isMobile ? "min-h-[44px]" : ""}`}
        />
        {!isViewer && (
          <button
            type="button"
            onClick={handleAiImprove}
            disabled={aiImproving || !item.description || item.description.length < 3}
            title={item.description.length < 3 ? "Scrivi prima una descrizione" : "Migliora con AI"}
            className="shrink-0 mt-1 p-0.5 rounded text-violet-400 hover:text-violet-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {aiImproving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {showAutocomplete && autocompleteItems.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-40 bg-background border rounded-lg shadow-lg mt-1 divide-y text-xs max-h-48 overflow-y-auto">
          <div className="px-3 py-1.5 text-muted-foreground font-medium bg-muted/30">
            Dal listino:
          </div>
          {autocompleteItems.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => applyFromListino(p)}
              className="w-full text-left px-3 py-2 hover:bg-muted/40 flex items-center justify-between gap-2"
            >
              <span className="flex-1 truncate">{p.description}</span>
              <span className="shrink-0 text-muted-foreground">{p.unitOfMeasure} €{p.unitPrice}</span>
            </button>
          ))}
        </div>
      )}

      {item.notes !== null && item.notes !== undefined && (
        <Input
          value={item.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Note..."
          className="mt-1 h-6 text-xs bg-transparent border-none shadow-none focus-visible:ring-0 text-muted-foreground placeholder:text-muted-foreground/40"
        />
      )}
    </div>
  );

  return (
    <div ref={setNodeRef} style={dragStyle}>
      {/* ── Desktop layout (md+) ── */}
      <div className="hidden md:grid grid-cols-[3rem_1fr_5rem_5.5rem_6rem_4rem_6rem_5.5rem] gap-1 px-4 py-2.5 hover:bg-muted/20 group items-start">
        {/* Drag + number */}
        <div className="flex items-center gap-1 pt-1.5">
          <GripVertical
            {...(!isViewer ? { ...attributes, ...listeners } : {})}
            className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0"
          />
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {itemNumber}
          </span>
        </div>

        {/* Description */}
        {descriptionBlock(descDesktopRef, false)}

        <Select
          value={item.unitOfMeasure}
          onValueChange={(v) => onUpdate({ unitOfMeasure: v })}
          disabled={isViewer}
        >
          <SelectTrigger className={`h-7 text-xs border-muted ${aiLoading ? "animate-pulse" : ""}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIT_OF_MEASURES.map((um) => (
              <SelectItem key={um} value={um} className="text-xs">{um}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          value={item.quantity}
          onChange={(e) => onUpdate({ quantity: Number(e.target.value) || 0 })}
          disabled={isViewer}
          className="h-7 text-xs text-right tabular-nums border-muted"
          step="0.01"
        />

        <Input
          type="number"
          value={item.unitPrice}
          onChange={(e) => onUpdate({ unitPrice: Number(e.target.value) || 0 })}
          disabled={isViewer}
          className={`h-7 text-xs text-right tabular-nums border-muted ${aiLoading ? "animate-pulse" : ""}`}
          step="0.01"
        />

        <Input
          type="number"
          value={item.discount}
          onChange={(e) => onUpdate({ discount: Number(e.target.value) || 0 })}
          disabled={isViewer}
          className="h-7 text-xs text-right tabular-nums border-muted"
          step="0.5"
          min="0"
          max="100"
        />

        <div className="text-right pt-1.5">
          <span className="text-sm font-medium tabular-nums">
            {formatCurrency(item.total)}
          </span>
        </div>

        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100">
          {item.images.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 relative"
              onClick={() => setShowImages(true)}
            >
              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] flex items-center justify-center font-bold">
                {item.images.length}
              </span>
            </Button>
          )}
          {perms.manageQuoteImages && item.images.length === 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 relative"
              onClick={() => setShowImages(true)}
            >
              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          )}
          {!isViewer && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={openSaveToListino}
                title="Salva nel listino"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDuplicate}>
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile card layout (< md) ── */}
      <div className="md:hidden px-3 py-3 space-y-2.5 border-b last:border-b-0">
        {/* Row 1: number + description */}
        <div className="flex gap-2 items-start">
          <div className="flex items-center gap-1 pt-2 shrink-0">
            <GripVertical
              {...(!isViewer ? { ...attributes, ...listeners } : {})}
              className="w-3.5 h-3.5 text-muted-foreground cursor-grab"
            />
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {itemNumber}
            </span>
          </div>
          {descriptionBlock(descMobileRef, true)}
        </div>

        {/* Row 2: U.M. | Qty | Prezzo | Sconto */}
        <div className="grid grid-cols-4 gap-2">
          <Select
            value={item.unitOfMeasure}
            onValueChange={(v) => onUpdate({ unitOfMeasure: v })}
            disabled={isViewer}
          >
            <SelectTrigger className="h-10 text-xs border-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OF_MEASURES.map((um) => (
                <SelectItem key={um} value={um} className="text-xs">{um}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={item.quantity}
            onChange={(e) => onUpdate({ quantity: Number(e.target.value) || 0 })}
            disabled={isViewer}
            className="h-10 text-sm text-right tabular-nums border-muted"
            placeholder="Qtà"
            step="0.01"
          />
          <Input
            type="number"
            value={item.unitPrice}
            onChange={(e) => onUpdate({ unitPrice: Number(e.target.value) || 0 })}
            disabled={isViewer}
            className="h-10 text-sm text-right tabular-nums border-muted"
            placeholder="€"
            step="0.01"
          />
          <Input
            type="number"
            value={item.discount}
            onChange={(e) => onUpdate({ discount: Number(e.target.value) || 0 })}
            disabled={isViewer}
            className="h-10 text-sm text-right tabular-nums border-muted"
            placeholder="Sc.%"
            step="0.5"
            min="0"
            max="100"
          />
        </div>

        {/* Row 3: total + actions */}
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold tabular-nums">
            {formatCurrency(item.total)}
          </span>
          <div className="flex items-center gap-1">
            {(perms.manageQuoteImages || item.images.length > 0) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 relative"
                onClick={() => setShowImages(true)}
              >
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                {item.images.length > 0 && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] flex items-center justify-center font-bold">
                    {item.images.length}
                  </span>
                )}
              </Button>
            )}
            {!isViewer && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  onClick={openSaveToListino}
                  title="Salva nel listino"
                >
                  <BookmarkPlus className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onDuplicate}>
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── AI Suggestion Banner ── */}
      {showAiBanner && (
        <div className="mx-4 mb-2 border border-violet-200 bg-violet-50/80 rounded-lg px-3 py-2 text-xs flex flex-wrap items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          <span className="text-violet-700 font-medium">Suggerimento AI:</span>
          <span className="text-violet-600">
            U.M.: <strong>{aiSuggestion!.unitOfMeasure}</strong> &bull; Prezzo: <strong>€{aiSuggestion!.unitPrice.toFixed(2)}/{aiSuggestion!.unitOfMeasure}</strong>
            {aiSuggestion!.matchedFromPriceList && (
              <span className="ml-1 text-green-600">• dal listino</span>
            )}
          </span>
          <div className="flex gap-1 ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2 border-violet-300 text-violet-700 hover:bg-violet-100"
              onClick={applySuggestion}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> Applica
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2 text-muted-foreground"
              onClick={() => { setSuggestionIgnored(true); setAiSuggestion(null); }}
            >
              Ignora
            </Button>
          </div>
        </div>
      )}

      {showImages && (
        <ImageUploader
          item={item}
          quoteId={quoteId}
          onClose={() => setShowImages(false)}
          onUpdate={(images) => onUpdate({ images })}
        />
      )}

      {showSaveModal && (
        <SaveToListinoModal
          item={item}
          categories={listinoCategories}
          onClose={() => setShowSaveModal(false)}
          onSaved={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}
