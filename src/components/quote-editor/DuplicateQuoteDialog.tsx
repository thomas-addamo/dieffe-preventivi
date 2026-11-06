"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Search, UserRound, Users } from "lucide-react";
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
import { cn } from "@/lib/utils";

// Duplica un preventivo (POST /api/quotes/[id]/duplicate): stesso cliente
// oppure un altro scelto dall'anagrafica. Con un cliente diverso l'indirizzo
// del cantiere si propone da quello del nuovo cliente ed è modificabile.

type ClientLite = { id: string; name: string; address: string | null };

export type DuplicateSource = {
  id: string;
  code: string;
  title: string;
  clientName: string | null;
};

/** Va montato solo quando serve (`{source && <DuplicateQuoteDialog …/>}`):
 *  ogni apertura parte da uno stato pulito. */
export function DuplicateQuoteDialog({
  source,
  onClose,
}: {
  source: DuplicateSource;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"same" | "other">("same");
  const [title, setTitle] = useState(`${source.title} (copia)`);
  const [clients, setClients] = useState<ClientLite[] | null>(null);
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "other" || clients) return;
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: ClientLite[]) => setClients(rows))
      .catch(() => setClients([]));
  }, [mode, clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clients ?? []).filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 50);
  }, [clients, search]);

  function pick(c: ClientLite) {
    setClientId(c.id);
    setAddress(c.address ?? "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "other" && !clientId) {
      toast.error("Scegli il cliente per la copia");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { title: title.trim() || `${source.title} (copia)` };
      if (mode === "other") {
        body.clientId = clientId;
        body.projectAddress = address.trim() || null;
      }
      const res = await fetch(`/api/quotes/${source.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Duplicazione non riuscita");
      toast.success(
        `Creato ${data.code}${data.photosSkipped ? ` (${data.photosSkipped} foto non copiate)` : ""}`
      );
      onClose();
      router.push(`/preventivi/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicazione non riuscita");
    } finally {
      setSaving(false);
    }
  }

  const option = (value: "same" | "other", icon: React.ReactNode, label: string, hint: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        mode === value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-accent"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          mode === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" /> Duplica preventivo
          </DialogTitle>
          <DialogDescription>
            {source.code}: sezioni, voci e foto vengono copiate in un nuovo preventivo in bozza, con un nuovo codice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            {option("same", <UserRound className="h-4 w-4" />, "Stesso cliente", source.clientName ?? "Nessun cliente")}
            {option("other", <Users className="h-4 w-4" />, "Un altro cliente", "Scegli dall'anagrafica")}
          </div>

          {mode === "other" && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca cliente…"
                  className="pl-8"
                />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border">
                {clients === null ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nessun cliente</p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pick(c)}
                      className={cn(
                        "flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                        clientId === c.id && "bg-primary/5"
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.name}</span>
                        {c.address && <span className="block truncate text-xs text-muted-foreground">{c.address}</span>}
                      </span>
                      {clientId === c.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  ))
                )}
              </div>
              {clientId && (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Indirizzo del cantiere</span>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Via, civico, comune" />
                </label>
              )}
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Titolo della copia</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving || (mode === "other" && !clientId)}>
              {saving ? <Loader2 className="animate-spin" /> : <Copy />} Duplica
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
