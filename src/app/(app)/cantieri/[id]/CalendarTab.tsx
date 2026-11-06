"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { isoDay, toDay } from "@/lib/sites/metrics";
import { EVENT_TYPES, formatDays, formatShortDate, type EventType } from "@/components/sites/site-ui";
import { siteRequest, useSiteMutation, type Phase, type SiteData, type SiteEventRow } from "./site-api";

// Calendario a scadenze del cantiere + analisi concreta del ritardo:
// quanto costa ogni giorno oltre la fine prevista e dopo quanti giorni il
// cantiere va in perdita.

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

type Draft = { id?: string; date: string; endDate: string; type: EventType; title: string; notes: string };

export function CalendarTab({ data, canManage, onEditSettings }: { data: SiteData; canManage: boolean; onEditSettings: () => void }) {
  const siteId = data.site.id;
  const today = toDay(new Date());
  const [month, setMonth] = useState(() => {
    const base = data.site.startDate && toDay(data.site.startDate) > today ? new Date(`${data.site.startDate}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = useSiteMutation<Draft>(siteId, (d) => {
    const body = { date: d.date, endDate: d.endDate || null, type: d.type, title: d.title.trim(), notes: d.notes.trim() || null };
    return d.id ? siteRequest("PATCH", `/api/sites/${siteId}/events/${d.id}`, body) : siteRequest("POST", `/api/sites/${siteId}/events`, body);
  });
  const remove = useSiteMutation<string>(
    siteId,
    (id) => siteRequest("DELETE", `/api/sites/${siteId}/events/${id}`),
    (d, id) => ({ ...d, events: d.events.filter((e) => e.id !== id) })
  );

  // Griglia del mese (settimane da lunedì).
  const cells = useMemo(() => {
    const first = toDay(month);
    const lead = (new Date(month).getDay() + 6) % 7;
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const total = Math.ceil((lead + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => first - lead + i);
  }, [month]);

  const eventsOn = (day: number) =>
    data.events.filter((e) => {
      const s = toDay(e.date);
      const end = e.endDate ? toDay(e.endDate) : s;
      return day >= s && day <= end;
    });
  // Fasi solo nei giorni lavorativi (il programma salta sabato e domenica).
  const phasesOn = (day: number) =>
    [0, 6].includes(new Date(day * 86_400_000).getUTCDay())
      ? []
      : data.phases.filter((p) => p.plannedStart && p.plannedEnd && day >= toDay(p.plannedStart) && day <= toDay(p.plannedEnd));
  const start = data.site.startDate ? toDay(data.site.startDate) : null;
  const end = data.site.plannedEndDate ? toDay(data.site.plannedEndDate) : null;
  const forecast = data.metrics.forecastEnd ? toDay(data.metrics.forecastEnd) : null;
  const monthIndex = month.getMonth();

  const openNew = (day: number) =>
    canManage && setDraft({ date: isoDay(day), endDate: "", type: "intervento", title: "", notes: "" });

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="surface">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold capitalize">{month.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setMonth(new Date())} className="text-xs">
                Oggi
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mese precedente">
                <ChevronLeft />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Mese successivo">
                <ChevronRight />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border text-xs">
            {WEEKDAYS.map((w) => (
              <div key={w} className="bg-muted/60 py-1 text-center font-medium text-muted-foreground">
                {w}
              </div>
            ))}
            {cells.map((day) => {
              const d = new Date(day * 86_400_000);
              const inMonth = d.getUTCMonth() === monthIndex;
              const evs = eventsOn(day);
              const phs = phasesOn(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => openNew(day)}
                  className={cn(
                    "relative flex min-h-[64px] flex-col items-stretch gap-0.5 bg-card p-1 text-left transition-colors md:min-h-[78px]",
                    !inMonth && "bg-card/60 text-muted-foreground/50",
                    canManage && "hover:bg-accent/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center self-start rounded-full text-[11px] tabular-nums",
                      day === today && "bg-primary font-semibold text-primary-foreground"
                    )}
                  >
                    {d.getUTCDate()}
                  </span>
                  {day === start && <Marker color="#3b82f6">Inizio</Marker>}
                  {day === end && <Marker color="#8b5cf6">Fine prevista</Marker>}
                  {forecast != null && forecast !== end && day === forecast && data.metrics.delayDays > 0 && (
                    <Marker color="#ef4444">Fine stimata</Marker>
                  )}
                  {phs.slice(0, 1).map((p) => (
                    <span key={p.id} className={cn("truncate rounded px-1 text-[10px]", p.doneAt ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-foreground/[0.06] text-muted-foreground")}>
                      {p.title}
                    </span>
                  ))}
                  {evs.slice(0, 2).map((e) => {
                    const meta = EVENT_TYPES[e.type as EventType] ?? EVENT_TYPES.altro;
                    return (
                      <span
                        key={e.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (canManage) setDraft({ id: e.id, date: e.date, endDate: e.endDate ?? "", type: e.type as EventType, title: e.title, notes: e.notes ?? "" });
                        }}
                        className="truncate rounded px-1 text-[10px] font-medium text-white"
                        style={{ background: meta.color }}
                        title={`${meta.label}: ${e.title}`}
                      >
                        {e.title}
                      </span>
                    );
                  })}
                  {evs.length > 2 && <span className="text-[10px] text-muted-foreground">+{evs.length - 2}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {Object.entries(EVENT_TYPES).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ background: v.color }} /> {v.label}
              </span>
            ))}
          </div>
        </div>

        <div className="surface">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Eventi</p>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => openNew(today)}>
                <Plus /> Nuovo evento
              </Button>
            )}
          </div>
          {data.events.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Nessun evento. Esempi: richiesta di occupazione del suolo pubblico, intervento dell’idraulico, consegna materiali.
            </p>
          ) : (
            <ul className="divide-y">
              {data.events.map((e: SiteEventRow) => {
                const meta = EVENT_TYPES[e.type as EventType] ?? EVENT_TYPES.altro;
                const Icon = meta.icon;
                const past = toDay(e.endDate ?? e.date) < today;
                return (
                  <li key={e.id} className={cn("group flex items-center gap-3 py-2", past && "opacity-60")}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: meta.color }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <button
                      className="min-w-0 flex-1 text-left"
                      disabled={!canManage}
                      onClick={() => setDraft({ id: e.id, date: e.date, endDate: e.endDate ?? "", type: e.type as EventType, title: e.title, notes: e.notes ?? "" })}
                    >
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatShortDate(e.date)}
                        {e.endDate ? ` → ${formatShortDate(e.endDate)}` : ""} · {meta.label}
                        {e.notes ? ` · ${e.notes}` : ""}
                      </p>
                    </button>
                    {canManage && (
                      <button
                        onClick={() => confirm(`Eliminare "${e.title}"?`) && remove.mutate(e.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
                        aria-label="Elimina evento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        <DelayAnalysis data={data} canManage={canManage} onEditSettings={onEditSettings} />
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Modifica evento" : "Nuovo evento"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(draft);
                setDraft(null);
              }}
            >
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(EVENT_TYPES) as EventType[]).map((k) => {
                  const meta = EVENT_TYPES[k];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setDraft({ ...draft, type: k })}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] transition-colors",
                        draft.type === k ? "border-transparent text-white" : "text-muted-foreground hover:bg-accent"
                      )}
                      style={draft.type === k ? { background: meta.color } : undefined}
                    >
                      <Icon className="h-4 w-4" />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <Input
                autoFocus
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder={draft.type === "suolo_pubblico" ? "Richiesta occupazione suolo pubblico" : draft.type === "intervento" ? "Interviene l'idraulico" : "Titolo"}
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs text-muted-foreground">
                  Dal
                  <Input type="date" required value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Al (facoltativo)
                  <Input type="date" min={draft.date} value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
                </label>
              </div>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={2}
                placeholder="Note (protocollo, ditta, contatto…)"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              <div className="flex justify-between gap-2">
                {draft.id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => {
                      remove.mutate(draft.id!);
                      setDraft(null);
                    }}
                  >
                    Elimina
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="submit" disabled={!draft.title.trim()}>
                  Salva
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Marker({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="truncate rounded px-1 text-[10px] font-semibold" style={{ color, background: `${color}1a` }}>
      {children}
    </span>
  );
}

/** Analisi tempi/costi con simulatore "se sforo di N giorni". */
function DelayAnalysis({ data, canManage, onEditSettings }: { data: SiteData; canManage: boolean; onEditSettings: () => void }) {
  const m = data.metrics;
  const s = data.site;
  const [simDays, setSimDays] = useState(Math.max(5, m.delayDays));
  const burn = m.dailyBurn;
  const simCost = simDays * burn;
  const simMargin = m.margin - simCost;
  const marginPct = m.contractNet > 0 ? (simMargin / m.contractNet) * 100 : 0;

  // Curve cumulative: programma (fine di ogni fase) e reale (fasi spuntate).
  const chart = useMemo(() => {
    if (!s.startDate) return null;
    const total = data.phases.reduce((a, p) => a + p.weight, 0) || data.phases.length;
    const w = (p: Phase) => (total === data.phases.length ? 1 : p.weight);
    const start = toDay(s.startDate);
    let acc = 0;
    const planned = [{ x: start, y: 0 }];
    for (const p of [...data.phases].filter((p) => p.plannedEnd).sort((a, b) => toDay(a.plannedEnd!) - toDay(b.plannedEnd!))) {
      acc += w(p);
      planned.push({ x: toDay(p.plannedEnd!), y: Math.round((acc / total) * 100) });
    }
    acc = 0;
    const actual = [{ x: start, y: 0 }];
    for (const p of [...data.phases].filter((p) => p.doneAt).sort((a, b) => toDay(a.doneAt!) - toDay(b.doneAt!))) {
      acc += w(p);
      actual.push({ x: Math.max(start, toDay(p.doneAt!)), y: Math.round((acc / total) * 100) });
    }
    const today = toDay(new Date());
    if (today > start && actual[actual.length - 1].x < today) actual.push({ x: today, y: actual[actual.length - 1].y });
    return { planned, actual };
  }, [data.phases, s.startDate]);

  if (!s.startDate || !s.plannedEndDate || !s.dailyCost) {
    return (
      <div className="surface space-y-3">
        <p className="font-semibold">Analisi tempi e costi</p>
        <p className="text-sm text-muted-foreground">
          Per calcolare quanto costa un ritardo servono la <b>data di inizio</b>, la <b>fine prevista</b> e il <b>costo giornaliero</b> del
          cantiere{s.dailyCost ? "" : " (l'IA ne ha proposto uno se il preventivo lo permetteva)"}.
        </p>
        {canManage && <Button onClick={onEditSettings}>Imposta tempi e costi</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Analisi tempi e costi</p>
          {canManage && (
            <button onClick={onEditSettings} className="text-xs font-medium text-primary hover:underline">
              Modifica
            </button>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Row label="Fine prevista" value={formatShortDate(s.plannedEndDate)} />
          <Row
            label="Fine stimata"
            value={m.forecastEnd ? formatShortDate(m.forecastEnd) : "—"}
            tone={m.delayDays > 0 ? "red" : undefined}
          />
          <Row label="Ritardo stimato" value={m.delayDays > 0 ? formatDays(m.delayDays) : "nessuno"} tone={m.delayDays > 0 ? "red" : "green"} />
          <Row label="Costo del ritardo" value={formatCurrency(m.delayCost)} tone={m.delayCost > 0 ? "red" : undefined} />
          <Row label="Costo al giorno" value={`${formatCurrency(burn)}`} />
          <Row label="Margine atteso" value={`${formatCurrency(m.margin)} (${s.marginPct}%)`} />
        </dl>
        {m.breakEvenDelayDays != null && (
          <p className="rounded-xl bg-foreground/[0.04] px-3 py-2 text-xs">
            Oltre <b>{formatDays(m.breakEvenDelayDays)}</b> di ritardo il cantiere va <b>in perdita</b>: ogni giorno in più costa{" "}
            {formatCurrency(burn)}
            {s.penaltyPerDay ? ` (di cui ${formatCurrency(s.penaltyPerDay)} di penale)` : ""}.
          </p>
        )}
      </div>

      <div className="surface space-y-3">
        <p className="font-semibold">E se sforassimo di…</p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={Math.max(60, (m.breakEvenDelayDays ?? 0) + 10, m.delayDays + 10)}
            value={simDays}
            onChange={(e) => setSimDays(Number(e.target.value))}
            className="flex-1 accent-[var(--primary)]"
            aria-label="Giorni di ritardo simulati"
          />
          <span className="w-20 text-right text-sm font-semibold tabular-nums">{formatDays(simDays)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-red-500/[0.07] p-2.5">
            <p className="text-xs text-muted-foreground">Costo in più</p>
            <p className="font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(simCost)}</p>
          </div>
          <div className={cn("rounded-xl p-2.5", simMargin >= 0 ? "bg-emerald-500/[0.07]" : "bg-red-500/[0.12]")}>
            <p className="text-xs text-muted-foreground">{simMargin >= 0 ? "Margine che resta" : "Perdita"}</p>
            <p className={cn("font-bold tabular-nums", simMargin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {formatCurrency(Math.abs(simMargin))} <span className="text-xs font-normal">({marginPct.toFixed(1)}%)</span>
            </p>
          </div>
        </div>
      </div>

      {chart && chart.planned.length > 1 && (
        <div className="surface">
          <p className="mb-2 font-semibold">Avanzamento: programma e reale</p>
          <div className="h-52">
            <ResponsiveContainer>
              <LineChart margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v) => formatShortDate(isoDay(v))}
                  tick={{ fontSize: 10 }}
                  allowDuplicatedCategory={false}
                />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={(v) => formatShortDate(isoDay(Number(v)))} formatter={(v) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine x={toDay(new Date())} stroke="#94a3b8" strokeDasharray="4 4" />
                <Line data={chart.planned} dataKey="y" name="Programma" stroke="#94a3b8" strokeDasharray="5 4" dot={false} type="stepAfter" />
                <Line data={chart.actual} dataKey="y" name="Reale" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} type="stepAfter" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "red" | "green" }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium tabular-nums", tone === "red" && "text-red-600 dark:text-red-400", tone === "green" && "text-emerald-600 dark:text-emerald-400")}>
        {value}
      </dd>
    </div>
  );
}
