"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { ProgressBar, formatShortDate } from "@/components/sites/site-ui";
import { TRIGGER_LABELS, siteRequest, useSiteMutation, type Milestone, type SiteData } from "./site-api";

// SAL e fatturazione: importo di ogni stato avanzamento (dalla percentuale del
// preventivo), quando scatta, e le due spunte Fatturato / Incassato.

export function MilestonesTab({ data, canManage }: { data: SiteData; canManage: boolean }) {
  const siteId = data.site.id;
  const m = data.metrics;
  const vatOf = new Map(data.quotes.map((q) => [q.id, q.vatRate]));
  const phaseTitle = new Map(data.phases.map((p) => [p.id, p.title]));
  const percentSum = data.milestones.filter((x) => x.amount == null).reduce((s, x) => s + (x.percent ?? 0), 0);
  const [adding, setAdding] = useState(false);

  const patch = useSiteMutation<{ id: string; body: Record<string, unknown> }>(
    siteId,
    ({ id, body }) => siteRequest("PATCH", `/api/sites/${siteId}/milestones/${id}`, body),
    (d, { id, body }) => {
      const now = new Date().toISOString();
      return {
        ...d,
        milestones: d.milestones.map((x) => {
          if (x.id !== id) return x;
          const next = { ...x };
          if ("invoiced" in body) {
            next.invoicedAt = body.invoiced ? now : null;
            if (body.invoiced) next.reachedAt = x.reachedAt ?? now;
            else next.paidAt = null;
          }
          if ("paid" in body) {
            next.paidAt = body.paid ? now : null;
            if (body.paid) next.invoicedAt = x.invoicedAt ?? now;
          }
          if ("reached" in body) next.reachedAt = body.reached ? now : null;
          if ("invoiceNumber" in body) next.invoiceNumber = body.invoiceNumber as string | null;
          return next;
        }),
      };
    }
  );
  const remove = useSiteMutation<string>(
    siteId,
    (id) => siteRequest("DELETE", `/api/sites/${siteId}/milestones/${id}`),
    (d, id) => ({ ...d, milestones: d.milestones.filter((x) => x.id !== id) })
  );
  const add = useSiteMutation<Record<string, unknown>>(siteId, (body) => siteRequest("POST", `/api/sites/${siteId}/milestones`, body));

  const triggerText = (x: Milestone) =>
    x.trigger === "phase" && x.phaseId ? `A fine "${phaseTitle.get(x.phaseId) ?? "fase"}"` : TRIGGER_LABELS[x.trigger];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Totale SAL" value={formatCurrency(m.milestonesTotal)} />
        <Stat label="Da fatturare" value={formatCurrency(m.toInvoice)} tone={m.toInvoice > 0 ? "amber" : undefined} />
        <Stat label="Fatturato" value={formatCurrency(m.invoiced)} />
        <Stat label="Da incassare" value={formatCurrency(m.toCollect)} tone={m.toCollect > 0 ? "amber" : undefined} />
      </div>
      {m.milestonesTotal > 0 && (
        <div className="surface space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Fatturato {Math.round((m.invoiced / m.milestonesTotal) * 100)}%</span>
            <span>Incassato {Math.round((m.paid / m.milestonesTotal) * 100)}%</span>
          </div>
          <ProgressBar value={(m.invoiced / m.milestonesTotal) * 100} />
        </div>
      )}
      {data.milestones.length > 0 && Math.abs(percentSum - 100) > 0.5 && data.milestones.every((x) => x.amount == null) && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Le percentuali dei SAL sommano {percentSum}% invece di 100%: controlla le condizioni di pagamento.
        </p>
      )}

      <div className="surface divide-y !p-0">
        {data.milestones.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nessun SAL. L’IA li ricava dalle condizioni di pagamento del preventivo; puoi aggiungerli anche a mano.
          </p>
        )}
        {data.milestones.map((x) => {
          const vat = (x.quoteId ? vatOf.get(x.quoteId) : undefined) ?? 22;
          const reached = !!x.reachedAt;
          return (
            <div key={x.id} className="group flex flex-col gap-3 px-3 py-3 md:flex-row md:items-center md:px-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {reached ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-foreground/25" />
                )}
                <div className="min-w-0">
                  <p className="font-medium">
                    {x.label}
                    {x.percent != null && x.amount == null && <span className="ml-1.5 text-sm text-muted-foreground">{x.percent}%</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {triggerText(x)} ·{" "}
                    {reached ? (
                      <span className="text-emerald-600 dark:text-emerald-400">raggiunto il {formatShortDate(x.reachedAt)}</span>
                    ) : (
                      "non ancora raggiunto"
                    )}
                    {x.trigger === "manual" && canManage && !x.invoicedAt && (
                      <button
                        onClick={() => patch.mutate({ id: x.id, body: { reached: !reached } })}
                        className="ml-1.5 font-medium text-primary hover:underline"
                      >
                        {reached ? "annulla" : "segna raggiunto"}
                      </button>
                    )}
                  </p>
                </div>
              </div>

              <div className="text-right md:w-36">
                <p className="font-semibold tabular-nums">{formatCurrency(x.value)}</p>
                <p className="text-[11px] text-muted-foreground">{formatCurrency(x.value * (1 + vat / 100))} con IVA</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:w-[300px] md:justify-end">
                <Toggle
                  label="Fatturato"
                  on={!!x.invoicedAt}
                  disabled={!canManage}
                  attention={reached && !x.invoicedAt}
                  onClick={() => patch.mutate({ id: x.id, body: { invoiced: !x.invoicedAt } })}
                />
                <Toggle
                  label="Incassato"
                  on={!!x.paidAt}
                  disabled={!canManage}
                  onClick={() => patch.mutate({ id: x.id, body: { paid: !x.paidAt } })}
                />
                {x.invoicedAt && (
                  <input
                    defaultValue={x.invoiceNumber ?? ""}
                    disabled={!canManage}
                    placeholder="N° fattura"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (x.invoiceNumber ?? null)) patch.mutate({ id: x.id, body: { invoiceNumber: v } });
                    }}
                    className="h-8 w-24 rounded-lg border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                  />
                )}
                {canManage && (
                  <button
                    onClick={() => confirm(`Eliminare il SAL "${x.label}"?`) && remove.mutate(x.id)}
                    className="rounded-md p-1.5 text-muted-foreground opacity-100 hover:bg-red-500/10 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Elimina SAL"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canManage &&
        (adding ? (
          <form
            className="surface grid gap-2 md:grid-cols-[1fr_90px_110px_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const pct = Number(String(fd.get("percent")).replace(",", "."));
              const amt = Number(String(fd.get("amount")).replace(",", "."));
              const phaseId = String(fd.get("phaseId") || "");
              add.mutate({
                label: String(fd.get("label")),
                percent: fd.get("percent") ? pct : null,
                amount: !fd.get("percent") && fd.get("amount") ? amt : null,
                ...(phaseId === "__end" ? { trigger: "end" } : phaseId ? { phaseId, trigger: "phase" } : { trigger: "manual" }),
              });
              setAdding(false);
            }}
          >
            <Input name="label" required placeholder="Descrizione (es. Fine impianti)" />
            <Input name="percent" inputMode="decimal" placeholder="%" />
            <Input name="amount" inputMode="decimal" placeholder="oppure €" />
            <select name="phaseId" className="h-10 rounded-lg border bg-card px-2 text-sm">
              <option value="">Lo segno io quando è raggiunto</option>
              <option value="__end">A fine lavori</option>
              {data.phases.map((p) => (
                <option key={p.id} value={p.id}>
                  A fine &quot;{p.title}&quot;
                </option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Annulla
              </Button>
              <Button type="submit">Aggiungi</Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus /> Aggiungi SAL
          </Button>
        ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div className="surface">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums", tone === "amber" && "text-amber-600 dark:text-amber-400")}>{value}</p>
    </div>
  );
}

function Toggle({
  label,
  on,
  disabled,
  attention,
  onClick,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  attention?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors disabled:cursor-default",
        on
          ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          : attention
            ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "text-muted-foreground hover:bg-accent"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", on ? "bg-emerald-500" : attention ? "bg-amber-500" : "bg-foreground/20")} />
      {label}
    </button>
  );
}
