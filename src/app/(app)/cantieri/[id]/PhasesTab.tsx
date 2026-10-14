"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, MessageSquareText, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { computeProgress, toDay } from "@/lib/sites/metrics";
import { formatShortDate } from "@/components/sites/site-ui";
import { siteRequest, useSiteMutation, type Phase, type SiteData } from "./site-api";

// Fasi dei lavori: si spuntano a mano, pesano quanto il loro importo e fanno
// scattare i SAL collegati. Spunta immediata (l'interfaccia non aspetta la rete).

export function PhasesTab({
  data,
  canManage,
  onAllDone,
}: {
  data: SiteData;
  canManage: boolean;
  onAllDone: () => void;
}) {
  const siteId = data.site.id;
  const [title, setTitle] = useState("");
  const [days, setDays] = useState("");
  const [openNote, setOpenNote] = useState<string | null>(null);
  const today = toDay(new Date());
  const totalWeight = data.phases.reduce((s, p) => s + p.weight, 0);

  const toggle = useSiteMutation<{ id: string; done: boolean }>(
    siteId,
    async ({ id, done }) => {
      const r = await siteRequest<{ allDone?: boolean }>("PATCH", `/api/sites/${siteId}/phases/${id}`, { done });
      if (done && r.allDone) onAllDone();
    },
    (d, { id, done }) => {
      const phases = d.phases.map((p) => (p.id === id ? { ...p, doneAt: done ? new Date().toISOString() : null } : p));
      return { ...d, phases, site: { ...d.site, progress: computeProgress(phases) }, metrics: { ...d.metrics, progress: computeProgress(phases) } };
    }
  );
  const patch = useSiteMutation<{ id: string; body: Record<string, unknown> }>(
    siteId,
    ({ id, body }) => siteRequest("PATCH", `/api/sites/${siteId}/phases/${id}`, body),
    (d, { id, body }) => ({ ...d, phases: d.phases.map((p) => (p.id === id ? { ...p, ...body } : p)) })
  );
  const remove = useSiteMutation<string>(
    siteId,
    (id) => siteRequest("DELETE", `/api/sites/${siteId}/phases/${id}`),
    (d, id) => ({ ...d, phases: d.phases.filter((p) => p.id !== id) })
  );
  const add = useSiteMutation<{ title: string; durationDays?: number }>(siteId, (body) =>
    siteRequest("POST", `/api/sites/${siteId}/phases`, body)
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const d = Number(days);
    add.mutate({ title: title.trim(), durationDays: Number.isFinite(d) && d > 0 ? Math.round(d) : undefined });
    setTitle("");
    setDays("");
  }

  if (data.phases.length === 0 && !canManage) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nessuna fase.</p>;
  }

  return (
    <div className="space-y-3">
      {data.setupPending && (
        <div className="surface flex items-center gap-2 text-sm text-primary">
          <Sparkles className="h-4 w-4 animate-pulse" /> L’IA sta ricavando fasi e SAL dal preventivo…
        </div>
      )}

      <ol className="surface divide-y !p-0">
        {data.phases.map((p: Phase, i) => {
          const done = !!p.doneAt;
          const late = !done && p.plannedEnd != null && toDay(p.plannedEnd) < today;
          const share = totalWeight > 0 ? (p.weight / totalWeight) * 100 : 0;
          return (
            <li key={p.id} className="group px-3 py-2.5 md:px-4">
              <div className="flex items-start gap-3">
                <button
                  disabled={!canManage}
                  onClick={() => toggle.mutate({ id: p.id, done: !done })}
                  aria-label={done ? "Segna da fare" : "Segna completata"}
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    done ? "border-emerald-500 bg-emerald-500 text-white" : "border-foreground/25 hover:border-emerald-500",
                    !canManage && "cursor-default"
                  )}
                >
                  {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className={cn("font-medium", done && "text-muted-foreground line-through decoration-foreground/30")}>{p.title}</p>
                    {p.source === "manual" && <span className="text-[10px] text-muted-foreground">aggiunta a mano</span>}
                    {late && <span className="text-[11px] font-medium text-red-600 dark:text-red-400">in ritardo</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.plannedStart ? `${formatShortDate(p.plannedStart)} → ${formatShortDate(p.plannedEnd)}` : "Date da fissare"}
                    {p.durationDays ? ` · ${p.durationDays} gg lav.` : ""}
                    {p.weight > 0 && ` · ${formatCurrency(p.weight)} (${share.toFixed(0)}%)`}
                    {done && ` · fatta il ${formatShortDate(p.doneAt)}`}
                  </p>
                  {p.note && openNote !== p.id && <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/80">{p.note}</p>}
                  {openNote === p.id && (
                    <form
                      className="mt-2 space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const dur = Number(fd.get("durationDays"));
                        const w = Number(String(fd.get("weight")).replace(",", "."));
                        patch.mutate({
                          id: p.id,
                          body: {
                            note: String(fd.get("note") ?? "").trim() || null,
                            ...(Number.isFinite(dur) && dur > 0 && dur !== p.durationDays ? { durationDays: Math.round(dur) } : {}),
                            ...(Number.isFinite(w) && w >= 0 && w !== p.weight ? { weight: w } : {}),
                          },
                        });
                        setOpenNote(null);
                      }}
                    >
                      <textarea
                        name="note"
                        defaultValue={p.note ?? ""}
                        rows={2}
                        placeholder="Nota sulla fase (es. ditta, materiali, problemi)…"
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <label className="flex items-center gap-1.5">
                          Durata
                          <Input name="durationDays" type="number" min={1} defaultValue={p.durationDays ?? ""} className="h-8 w-20" />
                          gg
                        </label>
                        <label className="flex items-center gap-1.5">
                          Peso
                          <Input name="weight" inputMode="decimal" defaultValue={p.weight || ""} className="h-8 w-28" />€
                        </label>
                        <div className="ml-auto flex gap-1.5">
                          <Button type="button" size="sm" variant="ghost" onClick={() => setOpenNote(null)}>
                            Annulla
                          </Button>
                          <Button type="submit" size="sm">
                            Salva
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>

                {canManage && (
                  <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                    <IconBtn label="Nota e dettagli" onClick={() => setOpenNote(openNote === p.id ? null : p.id)}>
                      <MessageSquareText />
                    </IconBtn>
                    <IconBtn label="Sposta su" disabled={i === 0} onClick={() => patch.mutate({ id: p.id, body: { move: -1 } })}>
                      <ArrowUp />
                    </IconBtn>
                    <IconBtn
                      label="Sposta giù"
                      disabled={i === data.phases.length - 1}
                      onClick={() => patch.mutate({ id: p.id, body: { move: 1 } })}
                    >
                      <ArrowDown />
                    </IconBtn>
                    <IconBtn
                      label="Elimina fase"
                      danger
                      onClick={() => {
                        if (confirm(`Eliminare la fase "${p.title}"?`)) remove.mutate(p.id);
                      }}
                    >
                      <Trash2 />
                    </IconBtn>
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {data.phases.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            {data.site.status === "pending"
              ? "Le fasi verranno generate quando il preventivo sarà accettato."
              : "Nessuna fase: aggiungine una qui sotto."}
          </li>
        )}
      </ol>

      {canManage && (
        <form onSubmit={submit} className="flex gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nuova fase (es. Demolizioni, Tetto)…" className="flex-1" />
          <Input
            value={days}
            onChange={(e) => setDays(e.target.value)}
            type="number"
            min={1}
            placeholder="Giorni"
            className="w-24"
            aria-label="Durata in giorni lavorativi"
          />
          <Button type="submit" disabled={!title.trim()}>
            <Plus /> Aggiungi
          </Button>
        </form>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 [&_svg]:h-3.5 [&_svg]:w-3.5",
        danger && "hover:bg-red-500/10 hover:text-red-600"
      )}
    >
      {children}
    </button>
  );
}
