// Lettura a regole delle condizioni di pagamento ("20% alla firma, 30% a fine
// demolizioni, saldo a fine lavori"): la riserva quando l'IA non risponde.
// Funzione pura, senza DB: la usano setup.ts e i test.

export type Trigger = "accept" | "start" | "phase" | "end" | "manual";

export type PlanMilestone = { label: string; percent: number | null; amount: number | null; trigger: Trigger; phase: number | null };

export function parsePaymentTerms(text: string): PlanMilestone[] {
  const parts = text
    .split(/[\n;]|,(?![^(]*\))(?=\s*(?:\d|acconto|saldo|anticipo|sal\b))/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: PlanMilestone[] = [];
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
