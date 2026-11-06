import "server-only";
import { sql, eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quotes, sites, sitePhases, siteMilestones, companySettings } from "@/lib/db/schema";
import { generateAIJson, isAiConfigured } from "@/lib/ai/client";
import { toPlainText } from "@/lib/rich-text";
import { generateId } from "@/lib/utils";
import { schedulePhases } from "./schedule";
import { recomputeSite } from "./recompute";

// ─────────────────────────────────────────────────────────────────────────────
// Preparazione di un preventivo accettato dentro il suo cantiere:
//  • FASI dei lavori: dalle sezioni del preventivo, raggruppate e messe nella
//    sequenza logica di cantiere dall'IA; ogni fase pesa quanto l'importo
//    delle sue lavorazioni (l'avanzamento % è quindi "vero", non a occhio);
//  • SAL: dalle condizioni di pagamento scritte a testo libero
//    ("20% inizio lavori, 30% a fine demolizioni…"), ognuno legato al momento
//    che lo fa scattare;
//  • durata stimata delle fasi e costo giornaliero del cantiere.
// Se l'IA è spenta o non risponde, un analizzatore a regole fa lo stesso
// lavoro in modo più semplice: il cantiere non resta mai vuoto.
// Si esegue UNA volta per preventivo (quotes.site_setup_at).
// ─────────────────────────────────────────────────────────────────────────────

type Trigger = "accept" | "start" | "phase" | "end" | "manual";

type SectionInfo = { code: string; title: string; amount: number; items: string[] };

type Plan = {
  phases: { title: string; sections: string[]; days: number }[];
  milestones: { label: string; percent: number | null; amount: number | null; trigger: Trigger; phase: number | null }[];
  dailyCost: number | null;
};

async function loadSections(quoteId: string): Promise<SectionInfo[]> {
  const res = await db.execute<{ code: string; title: string; amount: string | number; items: string[] | null }>(sql`
    select s.code, s.title,
           case when s.lump_sum then coalesce(s.lump_sum_price, 0) else coalesce(sum(i.total), 0) end as amount,
           (array_agg(left(i.description, 160) order by i.order_index) filter (where i.id is not null))[1:4] as items
    from quote_sections s
    left join quote_items i on i.section_id = s.id
    where s.quote_id = ${quoteId} and not (s.is_optional and not s.is_optional_included)
    group by s.id
    order by s.order_index`);
  return res.rows.map((r) => ({
    code: r.code,
    title: r.title,
    amount: Number(r.amount) || 0,
    items: (r.items ?? []).map((d) => toPlainText(d).slice(0, 90)),
  }));
}

// ── IA ────────────────────────────────────────────────────────────────────────

const SYSTEM = `Sei un direttore di cantiere esperto di ristrutturazioni edili in Italia.
Ricevi le sezioni di un preventivo (codice, titolo, importo, prime voci) e le condizioni di pagamento.
Rispondi SOLO con JSON:
{"phases":[{"title":"Demolizioni","sections":["A"],"days":4}],
 "milestones":[{"label":"Inizio lavori","percent":20,"amount":null,"trigger":"start","phase":null}],
 "dailyCost":380}

FASI
- Ogni codice di sezione va in UNA sola fase. Puoi unire sezioni affini (es. impianto idraulico ed elettrico → "Impianti") o tenerle separate.
- Ordina le fasi nella sequenza reale di cantiere: allestimento/ponteggi → demolizioni/rimozioni → opere strutturali/murature → impianti → massetti/intonaci → isolamenti/cappotto → pavimenti/rivestimenti → serramenti → tinteggiature/finiture → pulizie/smontaggio.
- Titoli brevi in italiano (max 4 parole), senza codici.
- "days": giorni lavorativi realistici per una squadra di 2-3 operai. Riferimento: circa 1 giorno ogni 1.000-1.500 € di lavorazioni a prevalenza manodopera; meno per le forniture costose.

SAL (milestones) — SOLO da quanto scritto nelle condizioni di pagamento, nello stesso ordine:
- percent = percentuale scritta; amount = importo fisso in € se scritto al posto della percentuale (altrimenti null).
- trigger: "accept" (accettazione, firma, contratto, ordine), "start" (inizio lavori), "phase" (a fine di una lavorazione: "fine demolizioni", "a fine massetti", "ultimazione intonaci", "a metà lavori"), "end" (saldo, fine lavori, consegna, collaudo), "manual" (SAL da concordare, mensili, non collegabili).
- con trigger "phase", "phase" è l'indice (da 0) della fase che lo fa scattare; per "a metà lavori" scegli la fase al cui termine i lavori sono circa a metà dell'importo. Negli altri casi phase = null.
- label breve (es. "Fine demolizioni", "Saldo a fine lavori").
- Se non ci sono condizioni di pagamento: milestones = [].

dailyCost: stima in € del costo di UN giorno di cantiere (manodopera della squadra + noli e attrezzature ricavabili dalle voci, es. ponteggio). Numero intero.`;

async function planWithAi(sections: SectionInfo[], paymentTerms: string, net: number): Promise<Plan | null> {
  try {
    const out = await generateAIJson<Partial<Plan>>(
      SYSTEM,
      JSON.stringify({
        sezioni: sections.map((s) => ({ codice: s.code, titolo: s.title, importo: Math.round(s.amount), voci: s.items })),
        condizioni_pagamento: paymentTerms || null,
        imponibile: Math.round(net),
      }),
      20000,
      1600
    );
    if (!Array.isArray(out.phases) || out.phases.length === 0) return null;
    return {
      phases: out.phases
        .filter((p) => p && typeof p.title === "string")
        .map((p) => ({
          title: p.title.trim().slice(0, 60),
          sections: Array.isArray(p.sections) ? p.sections.map(String) : [],
          days: Math.max(1, Math.min(120, Math.round(Number(p.days) || 1))),
        })),
      milestones: (Array.isArray(out.milestones) ? out.milestones : [])
        .filter((m) => m && typeof m.label === "string")
        .map((m) => ({
          label: m.label.trim().slice(0, 80),
          percent: m.percent != null && Number.isFinite(Number(m.percent)) ? Number(m.percent) : null,
          amount: m.amount != null && Number.isFinite(Number(m.amount)) ? Number(m.amount) : null,
          trigger: (["accept", "start", "phase", "end", "manual"] as const).includes(m.trigger as Trigger)
            ? (m.trigger as Trigger)
            : "manual",
          phase: m.phase != null && Number.isInteger(Number(m.phase)) ? Number(m.phase) : null,
        })),
      dailyCost: out.dailyCost != null && Number(out.dailyCost) > 0 ? Math.round(Number(out.dailyCost)) : null,
    };
  } catch (err) {
    console.warn("[sites] piano IA non disponibile:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Riserva a regole (senza IA) ───────────────────────────────────────────────

export function parsePaymentTerms(text: string): Plan["milestones"] {
  const parts = text
    .split(/[\n;]|,(?![^(]*\))(?=\s*(?:\d|acconto|saldo|anticipo|sal\b))/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: Plan["milestones"] = [];
  for (const part of parts) {
    const pct = part.match(/(\d+(?:[.,]\d+)?)\s*%/);
    const eur = part.match(/(?:€\s*(\d[\d.]*(?:,\d+)?))|(?:(\d[\d.]*(?:,\d+)?)\s*(?:€|euro))/i);
    if (!pct && !eur) continue;
    const lower = part.toLowerCase();
    const trigger: Trigger = /accettazione|firma|contratto|ordine/.test(lower)
      ? "accept"
      : /inizio lavori|avvio/.test(lower)
        ? "start"
        : /saldo|fine lavori|consegna|collaudo|ultimazione lavori/.test(lower)
          ? "end"
          : /fine |ultimazione|termine|metà/.test(lower)
            ? "phase"
            : "manual";
    const label = part
      .replace(/(\d+(?:[.,]\d+)?)\s*%/, "")
      .replace(/€\s*\d[\d.,]*|\d[\d.,]*\s*(€|euro)/gi, "")
      .replace(/^[\s,:\-–a]+(all'|alla|al|a)?\s*/i, "")
      .trim();
    const toNum = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
    out.push({
      label: (label.charAt(0).toUpperCase() + label.slice(1)).slice(0, 80) || (pct ? `SAL ${pct[1]}%` : "Acconto"),
      percent: pct ? toNum(pct[1]) : null,
      amount: !pct && eur ? toNum(eur[1] ?? eur[2]) : null,
      trigger,
      phase: null,
    });
  }
  return out;
}

function fallbackPlan(sections: SectionInfo[], paymentTerms: string): Plan {
  const phases = sections.map((s) => ({
    title: s.title.length > 60 ? s.title.slice(0, 57) + "…" : s.title,
    sections: [s.code],
    days: Math.max(1, Math.min(30, Math.round(s.amount / 1500))),
  }));
  const milestones = parsePaymentTerms(paymentTerms).map((m) => {
    if (m.trigger !== "phase") return m;
    const words = m.label.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const idx = phases.findIndex((p) => words.some((w) => p.title.toLowerCase().includes(w.slice(0, 6))));
    if (idx >= 0) return { ...m, phase: idx };
    if (/metà/i.test(m.label)) return { ...m, phase: Math.max(0, Math.floor(phases.length / 2) - 1) };
    return { ...m, trigger: "manual" as const };
  });
  return { phases, milestones, dailyCost: null };
}

// ── Correzioni a regole sul piano (IA o riserva) ─────────────────────────────

function cleanTitle(t: string) {
  const s = t.replace(/[|\t]+/g, " ").replace(/\s+/g, " ").trim();
  // TUTTO MAIUSCOLO → Solo la prima maiuscola
  const out = s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s;
  return out.slice(0, 60) || "Lavorazioni";
}

/** Durata minima credibile: ~1 giorno ogni 3.000 € (le forniture costano più della posa). */
const minDays = (weight: number) => Math.max(1, Math.round(weight / 3000));

/** Indice della fase al cui termine si supera la metà dell'importo. */
function midPhase(weights: number[]) {
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (total > 0 && acc >= total / 2) return i;
  }
  return Math.max(0, Math.floor(weights.length / 2) - 1);
}

// ── Esecuzione ────────────────────────────────────────────────────────────────

async function aiEnabled() {
  if (!isAiConfigured()) return false;
  const [s] = await db.select({ ai: companySettings.aiEnabled }).from(companySettings).limit(1);
  return s?.ai ?? true;
}

export async function setupQuoteInSite(siteId: string, quoteId: string): Promise<void> {
  const [[site], [quote]] = await Promise.all([
    db.select().from(sites).where(eq(sites.id, siteId)).limit(1),
    db
      .select({
        id: quotes.id,
        kind: quotes.kind,
        paymentTerms: quotes.paymentTerms,
        discountType: quotes.discountType,
        discountValue: quotes.discountValue,
        siteSetupAt: quotes.siteSetupAt,
      })
      .from(quotes)
      .where(eq(quotes.id, quoteId))
      .limit(1),
  ]);
  if (!site || !quote || quote.siteSetupAt) return;

  // Segna subito come preparato: due esecuzioni parallele non duplicano le fasi.
  const claimed = await db
    .update(quotes)
    .set({ siteSetupAt: new Date() })
    .where(and(eq(quotes.id, quoteId), isNull(quotes.siteSetupAt)))
    .returning({ id: quotes.id });
  if (claimed.length === 0) return;

  try {
    const sections = await loadSections(quoteId);
    const gross = sections.reduce((s, x) => s + x.amount, 0);
    const discount =
      quote.discountType === "percent" && quote.discountValue
        ? gross * (quote.discountValue / 100)
        : quote.discountType === "fixed" && quote.discountValue
          ? quote.discountValue
          : 0;
    const net = Math.max(0, gross - discount);
    const terms = toPlainText(quote.paymentTerms ?? "").trim();

    const plan = ((await aiEnabled()) && (await planWithAi(sections, terms, net))) || fallbackPlan(sections, terms);

    // Sezioni dimenticate dall'IA: diventano fasi a sé, nessun importo si perde.
    const assigned = new Set(plan.phases.flatMap((p) => p.sections));
    for (const s of sections) {
      if (!assigned.has(s.code)) plan.phases.push({ title: s.title.slice(0, 60), sections: [s.code], days: Math.max(1, Math.round(s.amount / 1500)) });
    }
    const amountOf = new Map(sections.map((s) => [s.code, s.amount]));

    const [{ maxOrder }] = (
      await db.execute<{ maxOrder: number }>(sql`
        select coalesce(max(order_index), -1)::int as "maxOrder" from site_phases where site_id = ${siteId}`)
    ).rows;

    const phaseRows = plan.phases.map((p, i) => {
      const weight = p.sections.reduce((s, c) => s + (amountOf.get(c) ?? 0), 0);
      const title = cleanTitle(p.title);
      return {
        id: generateId(),
        siteId,
        quoteId,
        title: quote.kind === "extra" && !/extra/i.test(title) ? `${title} (extra)` : title,
        weight,
        orderIndex: maxOrder + 1 + i,
        durationDays: Math.max(p.days, minDays(weight)),
        source: "ai" as const,
      };
    });

    // "A metà lavori": la fase dove si supera la metà dell'importo, non a occhio.
    const mid = midPhase(phaseRows.map((p) => p.weight));
    for (const m of plan.milestones) {
      if (/met[àa]\b/i.test(m.label) && m.trigger !== "accept" && m.trigger !== "end") {
        m.trigger = "phase";
        m.phase = mid;
      }
    }

    const msRows = plan.milestones.map((m, i) => ({
      id: generateId(),
      siteId,
      quoteId,
      label: m.label,
      percent: m.percent,
      amount: m.amount,
      trigger: m.trigger === "phase" && (m.phase == null || !phaseRows[m.phase]) ? ("manual" as const) : m.trigger,
      phaseId: m.trigger === "phase" && m.phase != null ? (phaseRows[m.phase]?.id ?? null) : null,
      orderIndex: i,
    }));

    if (phaseRows.length) await db.insert(sitePhases).values(phaseRows);
    if (msRows.length) await db.insert(siteMilestones).values(msRows);
    if (plan.dailyCost && site.dailyCost == null) {
      await db.update(sites).set({ dailyCost: plan.dailyCost }).where(eq(sites.id, siteId));
    }

    if (site.startDate) await schedulePhases(siteId);
    await recomputeSite(siteId);
  } catch (err) {
    // Annulla il lavoro parziale e libera il preventivo: verrà ripreparato.
    await db.batch([
      db.delete(siteMilestones).where(and(eq(siteMilestones.siteId, siteId), eq(siteMilestones.quoteId, quoteId))),
      db.delete(sitePhases).where(and(eq(sitePhases.siteId, siteId), eq(sitePhases.quoteId, quoteId))),
      db.update(quotes).set({ siteSetupAt: null }).where(eq(quotes.id, quoteId)),
    ]);
    throw err;
  }
}
