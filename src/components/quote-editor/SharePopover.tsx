"use client";

import { useState } from "react";
import { Share2, Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface SharePopoverProps {
  quoteId: string;
  quoteStatus: string;
  publicToken: string | null;
  publicTokenExpiresAt: string | Date | null;
  onTokenChange: (token: string | null, expiresAt: string | null) => void;
}

export function SharePopover({
  quoteId,
  quoteStatus,
  publicToken,
  publicTokenExpiresAt,
  onTokenChange,
}: SharePopoverProps) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);

  const isClosed = ["accepted", "rejected"].includes(quoteStatus);

  const linkUrl = publicToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${publicToken}`
    : null;

  const isExpired =
    publicTokenExpiresAt ? new Date() > new Date(publicTokenExpiresAt) : false;

  const expiresLabel = publicTokenExpiresAt
    ? format(new Date(publicTokenExpiresAt), "dd/MM/yyyy HH:mm", { locale: it })
    : null;

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) setGeneratedPin(null); // reset PIN quando si chiude il popover
  }

  async function generateLink() {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/public-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Errore"); return; }
      onTokenChange(data.token, data.expiresAt);
      setGeneratedPin(data.pin ?? null);
      toast.success("Link generato");
    } catch {
      toast.error("Errore di rete");
    } finally {
      setLoading(false);
    }
  }

  async function revokeLink() {
    if (!confirm("Revocare il link? Il cliente non potrà più accedervi.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/public-link`, { method: "DELETE" });
      if (!res.ok) { toast.error("Errore durante la revoca"); return; }
      onTokenChange(null, null);
      setGeneratedPin(null);
      toast.success("Link revocato");
    } catch {
      toast.error("Errore di rete");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!linkUrl) return;
    await navigator.clipboard.writeText(linkUrl);
    toast.success("Link copiato!");
  }

  async function copyPin() {
    if (!generatedPin) return;
    await navigator.clipboard.writeText(generatedPin);
    toast.success("PIN copiato!");
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Condividi</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Link condivisibile
        </p>

        {isClosed ? (
          <p className="text-sm text-muted-foreground">
            Questo preventivo è già stato{" "}
            {quoteStatus === "accepted" ? "accettato" : "rifiutato"} e non può
            essere condiviso nuovamente.
          </p>
        ) : publicToken && !isExpired ? (
          <div className="space-y-3">
            <div className="bg-muted/40 rounded-md px-3 py-2 text-xs font-mono break-all">
              {linkUrl}
            </div>
            <p className="text-xs text-muted-foreground">
              Scade il {expiresLabel}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={copyLink}>
                <Copy className="w-3.5 h-3.5" /> Copia
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => window.open(linkUrl!, "_blank")}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Apri
              </Button>
            </div>

            {/* PIN — mostrato solo subito dopo la generazione */}
            {generatedPin ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">PIN di accesso cliente:</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-center text-2xl font-mono font-bold tracking-widest text-amber-900 bg-white rounded border border-amber-200 px-3 py-1">
                    {generatedPin}
                  </span>
                  <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={copyPin}>
                    <Copy className="w-3 h-3" /> Copia
                  </Button>
                </div>
                <p className="text-xs text-amber-700">
                  ⚠️ Comunicalo al cliente di persona. Non viene salvato né inviato via email.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">PIN impostato ✓</p>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="w-full text-destructive hover:text-destructive gap-1.5"
              onClick={revokeLink}
              disabled={loading}
            >
              <Trash2 className="w-3.5 h-3.5" /> Revoca link
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {isExpired && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                Il link precedente è scaduto.
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Scadenza link</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(Math.min(365, Math.max(1, Number(e.target.value))))}
                  className="w-20 border rounded px-2 py-1.5 text-sm"
                />
                <span className="text-sm text-muted-foreground">giorni</span>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={generateLink}
              disabled={loading}
            >
              {loading ? "Generazione..." : "Genera link"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
