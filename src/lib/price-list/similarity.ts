// ─────────────────────────────────────────────────────────────────────────────
// Somiglianza tra descrizioni di voci edili, senza AI: normalizzazione,
// radici delle parole, misure. Serve a riconoscere la stessa lavorazione
// scritta in modi diversi ("Posa gres 30x60" / "posa di gres porcellanato
// 30x60") e a decidere quando chiedere conferma all'AI.
// ─────────────────────────────────────────────────────────────────────────────

const STOP = new Set([
  "di", "del", "della", "dei", "degli", "delle", "da", "dal", "dalla", "in", "con", "per", "su",
  "sul", "sulla", "a", "al", "alla", "ai", "e", "ed", "o", "il", "lo", "la", "i", "gli", "le",
  "un", "uno", "una", "compreso", "compresa", "compresi", "incluso", "inclusa", "eseguito",
  "eseguita", "fornitura", "posa", "opera", "tipo", "come", "mediante", "ogni", "onere",
  "oneri", "magistero", "regola", "arte", "materiale", "materiali", "relativo", "relativa",
]);

const MEASURE_RE = /\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)?/g;

function stem(w: string): string {
  // Radice grezza italiana: toglie desinenze comuni (piastrelle → piastrell).
  return w.length > 5 ? w.replace(/(azione|azioni|amento|amenti|mente|ura|ure|i|e|o|a)$/, "") : w;
}

export interface Fingerprint {
  tokens: Set<string>;
  measures: string[];
  /** Le parole "posa"/"fornitura" contano: posa ≠ fornitura e posa. */
  kind: "posa" | "fornitura" | "fp" | "";
}

export function fingerprint(text: string): Fingerprint {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const measures = (t.match(MEASURE_RE) ?? []).map((m) => m.replace(/\s+/g, "").replace(",", "."));
  const words = t
    .replace(MEASURE_RE, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w));
  const hasPosa = /\bpos[ao]\b|\bposat/.test(t);
  const hasForn = /\bfornitur/.test(t);
  return {
    tokens: new Set(words.map(stem)),
    measures,
    kind: hasPosa && hasForn ? "fp" : hasPosa ? "posa" : hasForn ? "fornitura" : "",
  };
}

/** 0…1: quanto due voci descrivono la stessa lavorazione. */
export function similarity(a: Fingerprint, b: Fingerprint): number {
  if (a.tokens.size === 0 || b.tokens.size === 0) return 0;
  let inter = 0;
  for (const t of a.tokens) if (b.tokens.has(t)) inter++;
  // Dice: più tollerante di Jaccard verso descrizioni di lunghezza diversa,
  // ma pesato sulla più corta così "Posa gres" ⊂ descrizione lunga conta.
  const dice = (2 * inter) / (a.tokens.size + b.tokens.size);
  const cover = inter / Math.min(a.tokens.size, b.tokens.size);
  let score = 0.6 * dice + 0.4 * cover;
  // Stessa misura rafforza; misure diverse (30x60 vs 60x120) = voci diverse.
  if (a.measures.length && b.measures.length) {
    if (a.measures.some((m) => b.measures.includes(m))) score += 0.15;
    else score *= 0.5;
  }
  if (a.kind && b.kind && a.kind !== b.kind) score *= 0.6;
  return Math.min(1, score);
}

/** Unità di misura compatibili (mq = m2, ml = m, ecc.). */
export function sameUnit(a: string, b: string): boolean {
  const n = (u: string) =>
    ({ m2: "mq", "m²": "mq", m3: "mc", "m³": "mc", m: "ml", mt: "ml", "n.": "n°", nr: "n°", pz: "n°", cad: "n°" })[
      u.toLowerCase().trim()
    ] ?? u.toLowerCase().trim();
  return n(a) === n(b);
}

/** Soglie condivise. */
export const SAME_ITEM = 0.82; // stessa voce senza dubbi
export const MAYBE_SAME = 0.55; // simili: decide l'AI

/**
 * Indice invertito per trovare velocemente i candidati simili tra centinaia di
 * voci senza confrontarle tutte con tutte.
 */
export class SimilarityIndex<T> {
  private entries: { item: T; fp: Fingerprint; unit: string }[] = [];
  private byToken = new Map<string, number[]>();

  add(item: T, text: string, unit: string) {
    const fp = fingerprint(text);
    const idx = this.entries.push({ item, fp, unit }) - 1;
    for (const t of fp.tokens) {
      const list = this.byToken.get(t);
      if (list) list.push(idx);
      else this.byToken.set(t, [idx]);
    }
  }

  /** Voci con stessa unità e somiglianza ≥ soglia, dalla più simile. */
  find(text: string, unit: string, threshold: number): { item: T; score: number }[] {
    const fp = fingerprint(text);
    const seen = new Set<number>();
    const out: { item: T; score: number }[] = [];
    for (const t of fp.tokens) {
      for (const idx of this.byToken.get(t) ?? []) {
        if (seen.has(idx)) continue;
        seen.add(idx);
        const e = this.entries[idx];
        if (!sameUnit(e.unit, unit)) continue;
        const score = similarity(fp, e.fp);
        if (score >= threshold) out.push({ item: e.item, score });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }
}
