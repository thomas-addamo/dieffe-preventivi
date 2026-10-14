import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sites, companySettings } from "@/lib/db/schema";
import { generateAIJson, isAiConfigured } from "@/lib/ai/client";
import { formatCurrency } from "@/lib/utils";
import { isoDay, toDay } from "./metrics";
import type { SiteDetail } from "./queries";

// ─────────────────────────────────────────────────────────────────────────────
// Consigli IA del cantiere: unici, perché costruiti sui SUOI dati (fasi in
// ritardo, SAL fermi, scadenze, noli, meteo per le lavorazioni all'aperto).
// Si salvano nel cantiere e si rigenerano solo quando lo stato cambia
// (impronta dei dati), non a ogni apertura della pagina.
// ─────────────────────────────────────────────────────────────────────────────

export type SiteTip = { title: string; body: string; priority: "alta" | "media" | "bassa"; kind: string };
export type SiteInsights = { tips: SiteTip[]; weather?: { date: string; rain: number; code: number; tmax: number }[] };

const OUTDOOR = /tett|copertur|facciat|cappott|estern|ponteggi|impermeabil|grondai|balcon|terrazz|giardin|recinz|scav|asfalt/i;
/** Intervallo minimo tra due generazioni automatiche (mentre si spuntano fasi). */
const MIN_INTERVAL = 30 * 60_000;

function fingerprint(d: SiteDetail): string {
  const today = toDay(new Date());
  const state = {
    p: Math.round(d.metrics.progress),
    h: d.metrics.health,
    dl: d.metrics.delayDays,
    ti: Math.round(d.metrics.toInvoice),
    ph: d.phases.map((p) => [p.title, !!p.doneAt, p.plannedEnd]),
    ev: d.events.filter((e) => toDay(e.date) >= today && toDay(e.date) <= today + 14).map((e) => [e.date, e.title]),
    s: [d.site.startDate, d.site.plannedEndDate, d.site.dailyCost],
  };
  return createHash("sha1").update(JSON.stringify(state)).digest("hex");
}

async function weather(lat: number, lng: number) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_sum,weathercode,temperature_2m_max&timezone=Europe%2FRome&forecast_days=6`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { daily?: { time: string[]; precipitation_sum: number[]; weathercode: number[]; temperature_2m_max: number[] } };
    if (!j.daily) return undefined;
    return j.daily.time.map((date, i) => ({
      date,
      rain: j.daily!.precipitation_sum[i] ?? 0,
      code: j.daily!.weathercode[i] ?? 0,
      tmax: j.daily!.temperature_2m_max[i] ?? 0,
    }));
  } catch {
    return undefined;
  }
}

const SYSTEM = `Sei il direttore tecnico di un'impresa edile (Dieffe Ristrutturazioni, Moncalieri).
Ricevi lo stato reale di UN cantiere e dai consigli operativi concreti, specifici per questo cantiere.
Rispondi SOLO con JSON: {"tips":[{"title":"...","body":"...","priority":"alta|media|bassa","kind":"tempi|soldi|meteo|organizzazione|sicurezza"}]}
Regole:
- Da 2 a 4 consigli, i più utili per primi. Niente consigli generici validi per qualsiasi cantiere.
- Cita numeri, date e fasi reali dai dati (es. "La fase Tetto è ferma da 9 giorni…").
- Soldi: SAL raggiunti e non fatturati, costo del ritardo, margine che si riduce, noli (es. ponteggio) che corrono.
- Tempi: fasi in ritardo rispetto alle date previste, prossime fasi da organizzare (ditte, materiali), eventi in scadenza (es. occupazione suolo pubblico che scade prima della fine stimata).
- Meteo: solo se ci sono lavorazioni all'aperto ancora da fare e previsioni di pioggia nei prossimi giorni.
- title max 60 caratteri, body max 220 caratteri, in italiano, tono diretto.`;

export function needsInsights(d: SiteDetail, force = false): boolean {
  if (d.site.status !== "active" || d.phases.length === 0) return false;
  const at = d.site.aiInsightsAt ? new Date(d.site.aiInsightsAt).getTime() : 0;
  if (force) return Date.now() - at > 2 * 60_000;
  return d.site.aiInsightsHash !== fingerprint(d) && Date.now() - at > MIN_INTERVAL;
}

export async function generateSiteInsights(d: SiteDetail): Promise<SiteInsights | null> {
  if (!isAiConfigured()) return null;
  const [cfg] = await db.select({ ai: companySettings.aiEnabled }).from(companySettings).limit(1);
  if (cfg && !cfg.ai) return null;

  const today = toDay(new Date());
  const m = d.metrics;
  const pending = d.phases.filter((p) => !p.doneAt);
  const forecast =
    d.site.lat != null && d.site.lng != null && pending.some((p) => OUTDOOR.test(p.title))
      ? await weather(d.site.lat, d.site.lng)
      : undefined;

  const input = {
    oggi: isoDay(today),
    cantiere: d.site.name,
    indirizzo: d.site.address,
    inizio: d.site.startDate,
    fine_prevista: d.site.plannedEndDate,
    fine_stimata: m.forecastEnd,
    avanzamento: `${Math.round(m.progress)}%`,
    avanzamento_atteso_oggi: m.expectedProgress != null ? `${Math.round(m.expectedProgress)}%` : null,
    giorni_ritardo_stimati: m.delayDays,
    costo_giornaliero: d.site.dailyCost,
    penale_giornaliera: d.site.penaltyPerDay,
    costo_ritardo: m.delayCost ? formatCurrency(m.delayCost) : null,
    margine: formatCurrency(m.margin),
    giorni_ritardo_per_andare_in_perdita: m.breakEvenDelayDays,
    imponibile: formatCurrency(m.contractNet),
    da_fatturare: formatCurrency(m.toInvoice),
    fatturato_non_incassato: formatCurrency(m.toCollect),
    fasi: d.phases.map((p) => ({
      fase: p.title,
      fatta: p.doneAt ? String(p.doneAt).slice(0, 10) : false,
      prevista: p.plannedStart ? `${p.plannedStart} → ${p.plannedEnd}` : null,
      importo: Math.round(p.weight),
      nota: p.note,
    })),
    sal: d.milestones.map((s) => ({
      sal: s.label,
      importo: Math.round(s.value),
      raggiunto: s.reachedAt ? String(s.reachedAt).slice(0, 10) : false,
      fatturato: !!s.invoicedAt,
      incassato: !!s.paidAt,
    })),
    eventi: d.events
      .filter((e) => toDay(e.date) >= today - 3)
      .slice(0, 12)
      .map((e) => ({ data: e.date, fine: e.endDate, tipo: e.type, titolo: e.title })),
    note_recenti: d.notes.slice(0, 5).map((n) => n.body.slice(0, 160)),
    meteo: forecast?.map((f) => ({ data: f.date, pioggia_mm: f.rain, tmax: f.tmax })),
  };

  try {
    const out = await generateAIJson<{ tips?: SiteTip[] }>(SYSTEM, JSON.stringify(input), 20000, 900);
    const tips = (out.tips ?? [])
      .filter((t) => t && typeof t.title === "string" && typeof t.body === "string")
      .slice(0, 4)
      .map((t) => ({
        title: t.title.slice(0, 80),
        body: t.body.slice(0, 300),
        priority: (["alta", "media", "bassa"] as const).includes(t.priority) ? t.priority : "media",
        kind: typeof t.kind === "string" ? t.kind : "organizzazione",
      }));
    const insights: SiteInsights = { tips, weather: forecast };
    await db
      .update(sites)
      .set({ aiInsights: insights, aiInsightsHash: fingerprint(d), aiInsightsAt: new Date() })
      .where(eq(sites.id, d.site.id));
    return insights;
  } catch (err) {
    console.warn("[sites] consigli IA non disponibili:", err instanceof Error ? err.message : err);
    return null;
  }
}
