"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudRain, Loader2, RefreshCw, Send, Sparkles, Sun, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/components/sites/site-ui";
import type { SiteInsights } from "@/lib/sites/insights";
import { siteKey, siteRequest, useSiteMutation, type SiteData } from "./site-api";

// Diario di cantiere (note datate) e consigli IA. I consigli si chiedono al
// server solo se i dati del cantiere sono cambiati: aprire la scheda non
// consuma chiamate IA.

const PRIORITY = {
  alta: "bg-red-500",
  media: "bg-amber-500",
  bassa: "bg-sky-500",
} as const;

export function useSiteInsights(data: SiteData) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const asked = useRef(false);

  async function load(force = false) {
    setLoading(true);
    try {
      const r = await siteRequest<{ insights: SiteInsights | null }>("POST", `/api/sites/${data.site.id}/insights`, { force });
      qc.setQueryData<SiteData>(siteKey(data.site.id), (d) => (d ? { ...d, site: { ...d.site, aiInsights: r.insights }, insightsStale: false } : d));
      qc.invalidateQueries({ queryKey: ["sites"] });
    } catch {
      /* consigli non disponibili: resta l'ultima versione */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (asked.current || !data.insightsStale) return;
    asked.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.insightsStale]);

  return { insights: data.site.aiInsights as SiteInsights | null, loading, refresh: () => load(true) };
}

export function InsightsCard({ data, compact }: { data: SiteData; compact?: boolean }) {
  const { insights, loading, refresh } = useSiteInsights(data);
  const tips = insights?.tips ?? [];
  const rainy = insights?.weather?.filter((w) => w.rain >= 2) ?? [];

  return (
    <div className="surface space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Consigli per questo cantiere
        </p>
        {data.site.status === "active" && data.phases.length > 0 && (
          <button onClick={refresh} disabled={loading} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Rigenera consigli" title="Rigenera">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        )}
      </div>
      {tips.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {loading
            ? "L'IA sta analizzando fasi, SAL, scadenze e meteo…"
            : data.site.status === "pending"
              ? "I consigli arrivano quando il preventivo viene accettato."
              : "Nessun consiglio per ora."}
        </p>
      ) : (
        <ul className={cn("space-y-3", loading && "opacity-60")}>
          {(compact ? tips.slice(0, 2) : tips).map((t, i) => (
            <li key={i} className="flex gap-2.5">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", PRIORITY[t.priority] ?? PRIORITY.media)} title={`Priorità ${t.priority}`} />
              <div>
                <p className="text-sm font-medium">{t.title}</p>
                <p className="text-sm text-muted-foreground">{t.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!compact && insights?.weather && insights.weather.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pt-1">
          {insights.weather.map((w) => (
            <div key={w.date} className={cn("flex min-w-[56px] flex-col items-center rounded-xl px-2 py-1.5 text-[11px]", w.rain >= 2 ? "bg-sky-500/12" : "bg-foreground/[0.04]")}>
              <span className="text-muted-foreground">{formatShortDate(w.date)}</span>
              {w.rain >= 2 ? <CloudRain className="my-0.5 h-4 w-4 text-sky-600" /> : <Sun className="my-0.5 h-4 w-4 text-amber-500" />}
              <span className="tabular-nums">{Math.round(w.tmax)}°</span>
            </div>
          ))}
        </div>
      )}
      {!compact && rainy.length > 0 && (
        <p className="text-xs text-muted-foreground">Meteo mostrato perché ci sono lavorazioni all’aperto ancora da fare.</p>
      )}
    </div>
  );
}

export function NotesTab({ data, canManage, userName }: { data: SiteData; canManage: boolean; userName: string }) {
  const siteId = data.site.id;
  const [body, setBody] = useState("");
  const add = useSiteMutation<string>(
    siteId,
    (text) => siteRequest("POST", `/api/sites/${siteId}/notes`, { body: text }),
    (d, text) => ({ ...d, notes: [{ id: `tmp-${Date.now()}`, body: text, createdAt: new Date().toISOString(), userName }, ...d.notes] })
  );
  const remove = useSiteMutation<string>(
    siteId,
    (id) => siteRequest("DELETE", `/api/sites/${siteId}/notes/${id}`),
    (d, id) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) })
  );

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-3">
        {canManage && (
          <form
            className="surface space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!body.trim()) return;
              add.mutate(body.trim());
              setBody("");
            }}
          >
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
              }}
              rows={3}
              placeholder="Diario di cantiere: cosa è successo oggi, problemi, accordi con il cliente…"
              className="w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={!body.trim()}>
                <Send /> Aggiungi nota
              </Button>
            </div>
          </form>
        )}
        <div className="surface divide-y !p-0">
          {data.notes.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nessuna nota.</p>}
          {data.notes.map((n) => (
            <div key={n.id} className="group px-4 py-3">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {n.userName ?? "—"} ·{" "}
                  {new Date(n.createdAt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                {canManage && !n.id.startsWith("tmp-") && (
                  <button
                    onClick={() => confirm("Eliminare la nota?") && remove.mutate(n.id)}
                    className="rounded p-1 hover:bg-red-500/10 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Elimina nota"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2">
        <InsightsCard data={data} />
      </div>
    </div>
  );
}
