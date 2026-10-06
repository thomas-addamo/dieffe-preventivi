"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MaintenanceReport } from "@/lib/price-list/maintenance";

// Riquadro "Riordino automatico" del listino: cosa fa, quando l'ha fatto,
// cosa ha cambiato; avvio manuale e mesi di conservazione (admin).

interface Status {
  retentionMonths: number;
  maintainedAt: string | null;
  report: MaintenanceReport | null;
  atRisk: number;
}

const RETENTION_OPTIONS = [6, 12, 18, 24, 36];

function summary(r: MaintenanceReport): string {
  const parts = [
    r.deleted && `${r.deleted} eliminat${r.deleted === 1 ? "a" : "e"}`,
    r.merged && `${r.merged} unit${r.merged === 1 ? "a" : "e"}`,
    r.categorized && `${r.categorized} catalogat${r.categorized === 1 ? "a" : "e"}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "nessuna modifica necessaria";
}

export function MaintenancePanel({ isAdmin, onDone }: { isAdmin: boolean; onDone: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [detail, setDetail] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/price-list/maintenance");
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/price-list/maintenance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Status | null) => alive && d && setStatus(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function run() {
    setRunning(true);
    try {
      const res = await fetch("/api/price-list/maintenance", { method: "POST" });
      if (!res.ok) throw new Error();
      const report = (await res.json()) as MaintenanceReport;
      toast.success(`Listino riordinato: ${summary(report)}`);
      await load();
      onDone();
      if (report.deleted || report.merged) setDetail(true);
    } catch {
      toast.error("Riordino non riuscito, riprova tra poco");
    } finally {
      setRunning(false);
    }
  }

  async function setRetention(months: number) {
    setStatus((s) => (s ? { ...s, retentionMonths: months } : s));
    const res = await fetch("/api/price-list/maintenance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retentionMonths: months }),
    });
    if (res.ok) {
      toast.success(`Le voci inutilizzate verranno eliminate dopo ${months} mesi`);
      void load();
    } else toast.error("Impostazione non salvata");
  }

  const report = status?.report ?? null;

  return (
    <section className="surface mb-4 space-y-3">
      <div className="flex items-start gap-3">
        {/* Icona 40px a 16px dal bordo: raggio 12 concentrico alla card */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wand2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-tight">Riordino automatico</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ogni notte cataloga le voci, unisce i doppioni con l&apos;AI e elimina quelle non usate nei
            preventivi da più di {status?.retentionMonths ?? 12} mesi. Le voci fissate non vengono mai toccate.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          {status?.maintainedAt ? (
            <p>
              <span className="font-medium text-foreground">
                Ultimo riordino {formatDistanceToNow(new Date(status.maintainedAt), { addSuffix: true, locale: it })}
              </span>
              {report && ` — ${summary(report)}`}
              {report && (report.deleted > 0 || report.merged > 0) && (
                <>
                  {" · "}
                  <button type="button" onClick={() => setDetail(true)} className="font-medium text-primary hover:underline">
                    dettagli
                  </button>
                </>
              )}
            </p>
          ) : (
            <p className="font-medium text-foreground">Il primo riordino avverrà questa notte.</p>
          )}
          {!!status?.atRisk && (
            <p className="mt-0.5 text-amber-600 dark:text-amber-400">
              {status.atRisk} voc{status.atRisk === 1 ? "e verrà eliminata" : "i verranno eliminate"} entro un mese se
              non usate (fissale per conservarle).
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isAdmin && status && (
            <Select value={String(status.retentionMonths)} onValueChange={(v) => setRetention(Number(v))}>
              <SelectTrigger className="h-9 w-[184px] bg-card md:h-9" aria-label="Conservazione voci inutilizzate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETENTION_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    Conserva {m} mesi
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 bg-card" onClick={run} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {running ? "Riordino…" : "Riordina ora"}
          </Button>
        </div>
      </div>

      <Dialog open={detail} onOpenChange={setDetail}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ultimo riordino del listino</DialogTitle>
            <DialogDescription>
              {report ? `${summary(report)} · ${report.total} voci nel catalogo` : ""}
              {report?.partial && " · completamento al prossimo giro"}
            </DialogDescription>
          </DialogHeader>
          {report && (
            <div className="space-y-4 text-sm">
              {report.mergedExamples.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Unite</p>
                  <ul className="divide-y rounded-lg border">
                    {report.mergedExamples.map((m, i) => (
                      <li key={i} className="px-3 py-2">
                        <span className="font-medium">{m.kept}</span>
                        <span className="block text-xs text-muted-foreground">
                          al posto di: {m.removed.join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.deletedExamples.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Eliminate perché non usate
                  </p>
                  <ul className="divide-y rounded-lg border">
                    {report.deletedExamples.map((d, i) => (
                      <li key={i} className="truncate px-3 py-2 text-muted-foreground">
                        {d}
                      </li>
                    ))}
                    {report.deleted > report.deletedExamples.length && (
                      <li className="px-3 py-2 text-xs italic text-muted-foreground">
                        … e altre {report.deleted - report.deletedExamples.length}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
