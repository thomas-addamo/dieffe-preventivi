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
  Unlock,
  UserCog,
} from "lucide-react";
import { SharePopover } from "./SharePopover";
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
import type { PriceListItem } from "@/lib/db/schema";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS, generateId, formatCurrency, formatDate } from "@/lib/utils";
import { calcQuoteTotals } from "@/lib/calculations";
import { usePermissions } from "@/hooks/use-permissions";
import { format } from "date-fns";
import { it } from "date-fns/locale";

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

// ─── Signature section (admin view) ──────────────────────────────────────────

function SignatureSection({
  signature,
  quoteId,
  quoteStatus,
  canEdit,
  onRevoked,
}: {
  signature: QuoteWithRelations["signature"];
  quoteId: string;
  quoteStatus: string;
  canEdit: boolean;
  onRevoked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const showRevokeButton = canEdit && (quoteStatus === "accepted" || quoteStatus === "rejected");

  async function handleRevoke() {
    setRevoking(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/signature`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setConfirmOpen(false);
      toast.success("Accettazione annullata. Il preventivo è tornato in stato Inviato.");
      onRevoked();
    } catch {
      toast.error("Errore durante l'annullamento dell'accettazione.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-muted/30 hover:bg-muted/50 transition-colors"
          onClick={() => setOpen((v) => !v)}
        >
          <span>Firma del cliente</span>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {open && (
          <div className="p-4">
            {!signature ? (
              <p className="text-sm text-muted-foreground">Nessuna firma presente.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-32 shrink-0">Nome firmatario:</span>
                  <span className="font-medium">{signature.signerName}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-32 shrink-0">Azione:</span>
                  <span className={`font-medium ${signature.action === "accepted" ? "text-green-600" : "text-red-600"}`}>
                    {signature.action === "accepted" ? "✅ Accettato" : "❌ Rifiutato"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-32 shrink-0">Data e ora:</span>
                  <span>
                    {signature.signedAt
                      ? format(new Date(signature.signedAt as unknown as string), "dd/MM/yyyy HH:mm", { locale: it })
                      : "—"}
                  </span>
                </div>
                {signature.signerEmail && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-32 shrink-0">Email:</span>
                    <span>{signature.signerEmail}</span>
                  </div>
                )}
                {signature.ipAddress && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-32 shrink-0">IP address:</span>
                    <span className="font-mono text-xs">{signature.ipAddress}</span>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <span className="text-muted-foreground w-32 shrink-0">Consenso IP:</span>
                  {signature.ipConsent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                      ✓ IP registrato con consenso esplicito
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 bg-zinc-100 border border-zinc-200 rounded px-2 py-0.5">
                      IP registrato senza consenso
                    </span>
                  )}
                </div>
                {signature.action === "accepted" && signature.signatureDataUrl && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Firma:</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signature.signatureDataUrl}
                      alt="Firma"
                      style={{ maxWidth: 300, border: "1px solid #e5e7eb", borderRadius: 4 }}
                    />
                  </div>
                )}
              </div>
            )}
            {showRevokeButton && (
              <div className="mt-4 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-400"
                  onClick={() => setConfirmOpen(true)}
                >
                  Annulla accettazione
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold">Sei sicuro di voler annullare l&apos;accettazione?</h2>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Riporterà il preventivo in stato &quot;Inviato&quot;</li>
              <li>Eliminerà i dati della firma</li>
              <li>Rigenererà un nuovo link pubblico (se era attivo)</li>
            </ul>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} disabled={revoking}>
                Annulla
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevoke}
                disabled={revoking}
              >
                {revoking ? "In corso..." : "Conferma"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface QuoteEditorProps {
  initialQuote: QuoteWithRelations;
  clients: { id: string; name: string }[];
  users?: { id: string; name: string }[];
}

const SECTION_CODES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function QuoteEditor({ initialQuote, clients, users = [] }: QuoteEditorProps) {
  const router = useRouter();
  const { isViewer, isAdmin, can: perms } = usePermissions();
  const [quote, setQuote] = useState<QuoteWithRelations>(initialQuote);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [mobileTotalsOpen, setMobileTotalsOpen] = useState(false);
  const [readonlyBannerDismissed, setReadonlyBannerDismissed] = useState(false);
  const [priceListItems, setPriceListItems] = useState<PriceListItem[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracks section IDs currently being deleted, so performSave won't
  // re-insert them if a stale debounce fires concurrently with the DELETE.
  const deletedSectionIdsRef = useRef<Set<string>>(new Set());

  // Tracks items/sections whose server-side creation POST is still in flight.
  // performSave skips these to avoid a double-insert race; deleteItem/deleteSection
  // abort the in-flight POST instead of calling DELETE (which would be a no-op).
  const pendingItemIdsRef = useRef<Set<string>>(new Set());
  const pendingSectionIdsRef = useRef<Set<string>>(new Set());
  const itemAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const sectionAbortControllersRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    if (isViewer) return;
    fetch("/api/price-list?isActive=true")
      .then((r) => r.ok ? r.json() : [])
      .then(setPriceListItems)
      .catch(() => {});
  }, [isViewer]);

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
        // Skip sections with a pending DELETE (re-insert guard).
        if (deletedSectionIdsRef.current.has(section.id)) continue;
        // Skip sections whose create POST is still in flight (they're persisted separately).
        if (pendingSectionIdsRef.current.has(section.id)) continue;

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
          // Skip items whose create POST is still in flight.
          if (pendingItemIdsRef.current.has(item.id)) continue;

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

  async function addSection(isOptional = false) {
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

    const controller = new AbortController();
    pendingSectionIdsRef.current.add(newSection.id);
    sectionAbortControllersRef.current.set(newSection.id, controller);

    // Optimistic UI update — no scheduleSave, create is persisted immediately below.
    setQuote((prev) => ({ ...prev, sections: [...prev.sections, newSection] }));

    try {
      const res = await fetch(`/api/quotes/${quote.id}/sections`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newSection.id,
          code: newSection.code,
          title: newSection.title,
          description: newSection.description,
          orderIndex: newSection.orderIndex,
          sectionNote: newSection.sectionNote,
          isOptional: newSection.isOptional,
          isOptionalIncluded: newSection.isOptionalIncluded,
        }),
      });
      if (!res.ok) throw new Error("server");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Deleted before create completed; clean up in case POST already landed.
        fetch(`/api/quotes/${quote.id}/sections/${newSection.id}`, { method: "DELETE" }).catch(() => {});
      } else {
        setQuote((prev) => ({
          ...prev,
          sections: prev.sections.filter((s) => s.id !== newSection.id),
        }));
        toast.error("Errore durante la creazione della sezione");
      }
    } finally {
      pendingSectionIdsRef.current.delete(newSection.id);
      sectionAbortControllersRef.current.delete(newSection.id);
    }
  }

  function updateSection(sectionId: string, patch: Partial<SectionWithItems>) {
    updateQuote({
      sections: quote.sections.map((s) =>
        s.id === sectionId ? { ...s, ...patch } : s
      ),
    });
  }

  async function deleteSection(sectionId: string) {
    // If the section's create POST is still in flight, abort it instead of DELETE-ing.
    if (pendingSectionIdsRef.current.has(sectionId)) {
      sectionAbortControllersRef.current.get(sectionId)?.abort();
      setQuote((prev) => ({
        ...prev,
        sections: prev.sections.filter((s) => s.id !== sectionId),
      }));
      return;
    }

    // Mark as pending delete BEFORE state update so performSave won't re-insert.
    deletedSectionIdsRef.current.add(sectionId);

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

  async function addItem(sectionId: string) {
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

    const controller = new AbortController();
    pendingItemIdsRef.current.add(newItem.id);
    itemAbortControllersRef.current.set(newItem.id, controller);

    // Optimistic UI update — no scheduleSave, create is persisted immediately below.
    setQuote((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, items: [...s.items, newItem] } : s
      ),
    }));

    try {
      const res = await fetch(`/api/quotes/${quote.id}/items`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newItem.id,
          sectionId,
          description: newItem.description,
          unitOfMeasure: newItem.unitOfMeasure,
          quantity: newItem.quantity,
          unitPrice: newItem.unitPrice,
          discount: newItem.discount,
          notes: newItem.notes,
          orderIndex: newItem.orderIndex,
        }),
      });
      if (!res.ok) throw new Error("server");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Deleted before create completed; clean up in case POST already landed.
        fetch(`/api/quotes/${quote.id}/items/${newItem.id}`, { method: "DELETE" }).catch(() => {});
      } else {
        setQuote((prev) => ({
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== newItem.id) } : s
          ),
        }));
        toast.error("Errore durante la creazione della voce");
      }
    } finally {
      pendingItemIdsRef.current.delete(newItem.id);
      itemAbortControllersRef.current.delete(newItem.id);
    }
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
    // Remove from UI immediately.
    setQuote((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s
      ),
    }));

    if (pendingItemIdsRef.current.has(itemId)) {
      // Create POST still in flight — abort it; addItem's catch fires a cleanup DELETE.
      itemAbortControllersRef.current.get(itemId)?.abort();
      return;
    }

    // Item is confirmed server-side — DELETE immediately.
    fetch(`/api/quotes/${quote.id}/items/${itemId}`, { method: "DELETE" })
      .catch(() => toast.error("Errore eliminazione voce"));
  }

  async function duplicateItem(sectionId: string, itemId: string) {
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
    const items = [...section.items, dup].sort((a, b) => a.orderIndex - b.orderIndex);

    const controller = new AbortController();
    pendingItemIdsRef.current.add(dup.id);
    itemAbortControllersRef.current.set(dup.id, controller);

    setQuote((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, items } : s
      ),
    }));

    try {
      const res = await fetch(`/api/quotes/${quote.id}/items`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: dup.id,
          sectionId,
          description: dup.description,
          unitOfMeasure: dup.unitOfMeasure,
          quantity: dup.quantity,
          unitPrice: dup.unitPrice,
          discount: dup.discount,
          notes: dup.notes,
          orderIndex: dup.orderIndex,
        }),
      });
      if (!res.ok) throw new Error("server");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        fetch(`/api/quotes/${quote.id}/items/${dup.id}`, { method: "DELETE" }).catch(() => {});
      } else {
        setQuote((prev) => ({
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== dup.id) } : s
          ),
        }));
        toast.error("Errore durante la duplicazione della voce");
      }
    } finally {
      pendingItemIdsRef.current.delete(dup.id);
      itemAbortControllersRef.current.delete(dup.id);
    }
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
    if (!confirm("Spostare questo preventivo nel cestino?"))
      return;
    const res = await fetch(`/api/quotes/${quote.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Preventivo spostato nel cestino");
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

  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignUserId, setReassignUserId] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [locking, setLocking] = useState(false);

  async function toggleLock() {
    setLocking(true);
    const isCurrentlyLocked = quote.isLocked;
    const res = await fetch(`/api/quotes/${quote.id}/${isCurrentlyLocked ? "unlock" : "lock"}`, { method: "PATCH" });
    setLocking(false);
    if (res.ok) {
      setQuote((q) => ({ ...q, isLocked: !isCurrentlyLocked }));
      toast.success(isCurrentlyLocked ? "Preventivo sbloccato." : "Preventivo bloccato.");
    } else {
      toast.error("Errore durante l'operazione.");
    }
  }

  async function doReassign() {
    if (!reassignUserId) return;
    setReassigning(true);
    const res = await fetch(`/api/quotes/${quote.id}/reassign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: reassignUserId }),
    });
    setReassigning(false);
    if (res.ok) {
      setShowReassignModal(false);
      toast.success("Preventivo riassegnato.");
    } else {
      toast.error("Errore durante la riassegnazione.");
    }
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

      {/* Lock banner for non-admin */}
      {quote.isLocked && !isAdmin && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-sm text-yellow-800">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Questo preventivo è bloccato dall&apos;amministratore. Contatta l&apos;admin per sbloccare.</span>
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
          {perms.editQuote && (
            <SharePopover
              quoteId={quote.id}
              quoteStatus={quote.status}
              publicToken={quote.publicToken ?? null}
              publicTokenExpiresAt={quote.publicTokenExpiresAt ?? null}
              onTokenChange={(token, expiresAt) =>
                setQuote((prev) => ({
                  ...prev,
                  publicToken: token,
                  publicTokenExpiresAt: expiresAt as never,
                }))
              }
            />
          )}

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

          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8"
                onClick={toggleLock}
                disabled={locking}
                title={quote.isLocked ? "Sblocca modifiche" : "Blocca modifiche"}
              >
                {quote.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span className="hidden lg:inline">{quote.isLocked ? "Sblocca" : "Blocca"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setShowReassignModal(true)}
                title="Riassegna preventivo"
              >
                <UserCog className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Riassegna</span>
              </Button>
            </>
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
              priceListItems={priceListItems}
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

            {/* Firma del cliente */}
            <SignatureSection
              signature={quote.signature ?? null}
              quoteId={quote.id}
              quoteStatus={quote.status}
              canEdit={isAdmin}
              onRevoked={() =>
                setQuote((q) => ({
                  ...q,
                  status: "sent",
                  publicToken: null,
                  publicTokenExpiresAt: null,
                  signature: null,
                }))
              }
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

      {/* Reassign modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="font-semibold text-lg mb-1">Riassegna preventivo</h2>
            <p className="text-sm text-muted-foreground mb-4">Assegna questo preventivo a un altro utente.</p>
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">Utente attuale</p>
              <p className="text-sm font-medium">{quote.author.name}</p>
            </div>
            <div className="mb-5">
              <label className="text-xs text-muted-foreground block mb-1">Nuovo utente</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={reassignUserId}
                onChange={(e) => setReassignUserId(e.target.value)}
              >
                <option value="">Seleziona utente...</option>
                {users.filter((u) => u.id !== quote.userId).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowReassignModal(false); setReassignUserId(""); }}
                className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
              >
                Annulla
              </button>
              <button
                onClick={doReassign}
                disabled={!reassignUserId || reassigning}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50"
              >
                {reassigning ? "..." : "Riassegna"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
