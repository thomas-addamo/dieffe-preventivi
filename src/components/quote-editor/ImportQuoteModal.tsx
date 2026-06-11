"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  Loader2,
  Sparkles,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import type { ParsedQuote } from "@/lib/import/parse-quote";

const ACCEPT = ".pdf,.docx,.xlsx,.xls,.csv,.txt";
const MAX_FILE_SIZE = 8 * 1024 * 1024;

type MatchedClient = { id: string; name: string } | null;
type ClientMode = "existing" | "new" | "none";
type Step = "upload" | "analyzing" | "preview";

interface ImportQuoteModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

function sectionSubtotal(s: ParsedQuote["sections"][number]) {
  if (s.lumpSumPrice != null && s.lumpSumPrice > 0) return s.lumpSumPrice;
  return s.items.reduce(
    (acc, i) => acc + i.quantity * i.unitPrice * (1 - i.discount / 100),
    0
  );
}

function computeTotals(parsed: ParsedQuote) {
  const subtotal = parsed.sections.reduce((sum, s) => sum + sectionSubtotal(s), 0);
  const vatRate = parsed.vatRate ?? 22;
  const vatAmount = subtotal * (vatRate / 100);
  return { subtotal, vatRate, vatAmount, total: subtotal + vatAmount };
}

export function ImportQuoteModal({
  open,
  onClose,
  onCreated,
}: ImportQuoteModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedQuote | null>(null);
  const [matchedClient, setMatchedClient] = useState<MatchedClient>(null);
  const [clientMode, setClientMode] = useState<ClientMode>("none");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  function reset() {
    setStep("upload");
    setDragOver(false);
    setFileName("");
    setParsed(null);
    setMatchedClient(null);
    setClientMode("none");
    setTitle("");
    setCreating(false);
  }

  function handleClose() {
    if (step === "analyzing" || creating) return;
    reset();
    onClose();
  }

  async function analyze(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File troppo grande (max 8 MB)");
      return;
    }
    setFileName(file.name);
    setStep("analyzing");

    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/quotes/import", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Errore durante l'analisi del file");
        setStep("upload");
        return;
      }
      const p: ParsedQuote = json.parsed;
      setParsed(p);
      setMatchedClient(json.matchedClient ?? null);
      setClientMode(json.matchedClient ? "existing" : p.client ? "new" : "none");
      setTitle(p.title);
      setStep("preview");
    } catch {
      toast.error("Errore di rete durante l'analisi");
      setStep("upload");
    }
  }

  async function create() {
    if (!parsed) return;
    setCreating(true);
    try {
      const res = await fetch("/api/quotes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || parsed.title,
          clientMode,
          clientId: clientMode === "existing" ? matchedClient?.id : undefined,
          client: clientMode === "new" ? parsed.client : undefined,
          projectAddress: parsed.projectAddress,
          vatRate: parsed.vatRate ?? undefined,
          notes: parsed.notes,
          paymentTerms: parsed.paymentTerms,
          validUntil: parsed.validUntil,
          sections: parsed.sections,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Errore durante la creazione");
        setCreating(false);
        return;
      }
      toast.success("Preventivo importato con successo");
      reset();
      onCreated(json.id);
    } catch {
      toast.error("Errore di rete durante la creazione");
      setCreating(false);
    }
  }

  const totals = parsed ? computeTotals(parsed) : null;
  // Il totale dichiarato nel documento può essere imponibile o IVA inclusa:
  // segnala solo se non combacia con nessuno dei due (tolleranza 2%).
  const mismatch =
    parsed && totals
      ? [parsed.declaredTotal, parsed.declaredSubtotal]
          .filter((v): v is number => v != null && v > 0)
          .every(
            (v) =>
              Math.abs(v - totals.total) / v > 0.02 &&
              Math.abs(v - totals.subtotal) / v > 0.02
          ) &&
        (parsed.declaredTotal != null || parsed.declaredSubtotal != null)
      : false;

  const itemCount =
    parsed?.sections.reduce((n, s) => n + s.items.length, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            Importa preventivo da file
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="pt-2">
            <div
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) analyze(file);
              }}
            >
              <div className="p-3 rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="font-medium text-sm">
                  Trascina qui il file o clicca per selezionarlo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  L&apos;AI leggerà il documento e creerà il preventivo con voci,
                  prezzi e dati cliente.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Formati: PDF, Word (.docx), Excel (.xlsx), CSV, TXT — max 8 MB
              </p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) analyze(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div className="py-12 flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            <div>
              <p className="font-medium text-sm flex items-center gap-2 justify-center">
                <FileText className="w-4 h-4" /> {fileName}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                L&apos;AI sta leggendo e interpretando il preventivo…
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Può richiedere fino a un minuto per documenti lunghi.
              </p>
            </div>
          </div>
        )}

        {step === "preview" && parsed && totals && (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="import-title">Titolo</Label>
                <Input
                  id="import-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Cliente</Label>
                {parsed.client ? (
                  <Select
                    value={clientMode}
                    onValueChange={(v) => setClientMode(v as ClientMode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {matchedClient && (
                        <SelectItem value="existing">
                          Usa cliente esistente: {matchedClient.name}
                        </SelectItem>
                      )}
                      <SelectItem value="new">
                        Crea nuovo cliente: {parsed.client.name}
                      </SelectItem>
                      <SelectItem value="none">Nessun cliente</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground border rounded-md px-3 py-2">
                    Nessun cliente rilevato nel documento
                  </p>
                )}
              </div>

              {parsed.projectAddress && (
                <p className="text-xs text-muted-foreground">
                  Cantiere: {parsed.projectAddress}
                </p>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Contenuto rilevato</Label>
                  <span className="text-xs text-muted-foreground">
                    {parsed.sections.length} sezion
                    {parsed.sections.length === 1 ? "e" : "i"} · {itemCount} voc
                    {itemCount === 1 ? "e" : "i"}
                  </span>
                </div>
                {parsed.sections.map((section, si) => {
                  const isLump =
                    section.lumpSumPrice != null && section.lumpSumPrice > 0;
                  return (
                    <div key={si} className="border rounded-lg overflow-hidden">
                      <div className="bg-muted/40 px-3 py-2 flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">
                          {section.title}
                        </p>
                        <span className="flex items-center gap-1.5 shrink-0">
                          {isLump && (
                            <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 hover:bg-amber-100">
                              a corpo
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {formatCurrency(sectionSubtotal(section))}
                          </Badge>
                        </span>
                      </div>
                      <div className="divide-y">
                        {section.items.map((item, ii) => (
                          <div
                            key={ii}
                            className="px-3 py-1.5 flex items-baseline justify-between gap-3 text-sm"
                          >
                            <span className="truncate" title={item.description}>
                              {item.description}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
                              {isLump
                                ? `${item.quantity} ${item.unitOfMeasure}`
                                : `${item.quantity} ${item.unitOfMeasure} × ${formatCurrency(item.unitPrice)}${item.discount > 0 ? ` −${item.discount}%` : ""}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border rounded-lg p-3 space-y-1 text-sm bg-muted/20">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Imponibile</span>
                  <span className="tabular-nums">
                    {formatCurrency(totals.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    IVA {totals.vatRate}%
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(totals.vatAmount)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t">
                  <span>Totale</span>
                  <span className="tabular-nums">
                    {formatCurrency(totals.total)}
                  </span>
                </div>
              </div>

              {mismatch && (
                <div className="flex items-start gap-2 text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300 p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>
                    Il totale calcolato non coincide con quello indicato nel
                    documento (
                    {formatCurrency(
                      parsed.declaredTotal ?? parsed.declaredSubtotal ?? 0
                    )}
                    ). Controlla le voci dopo l&apos;importazione.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setParsed(null);
                  setStep("upload");
                }}
                disabled={creating}
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Altro file
              </Button>
              <Button type="button" onClick={create} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crea preventivo
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
