// ─────────────────────────────────────────────────────────────────────────────
// Estrazione misure e generazione di etichette/codici "intelligenti" per voci
// di preventivo edile. Logica pura (no AI, no DB) → veloce, testabile, gratis.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedMeasure {
  /** Quantità calcolata dalla descrizione (es. "3x3" → 9), o null se assente. */
  quantity: number | null;
  /** Unità di misura dedotta dalle misure presenti (mq/mc/ml/n°), o null. */
  unitOfMeasure: string | null;
  /** Testo compatto della misura, es. "3x3", "25 mq", "ø100", "12 ml". */
  label: string | null;
}

const NUM = String.raw`\d+(?:[.,]\d+)?`;

/** Converte "3,5" → 3.5 */
function toNum(s: string): number {
  return parseFloat(s.replace(",", "."));
}

/**
 * Estrae misure da una descrizione edile italiana.
 * Riconosce: AxB, AxBxC, "25 mq", "12 ml", "3 mc", diametri "ø100".
 * L'ordine dei pattern conta: prima i più specifici.
 */
export function extractMeasure(description: string): ExtractedMeasure {
  const text = description.toLowerCase();

  // AxBxC → volume (mc)  es. "3x3x2.7"
  const vol = text.match(new RegExp(`(${NUM})\\s*[x×]\\s*(${NUM})\\s*[x×]\\s*(${NUM})`));
  if (vol) {
    const [a, b, c] = [toNum(vol[1]), toNum(vol[2]), toNum(vol[3])];
    return {
      quantity: round2(a * b * c),
      unitOfMeasure: "mc",
      label: `${vol[1]}x${vol[2]}x${vol[3]}`,
    };
  }

  // AxB → area (mq)  es. "3x3", "4,5 x 2"
  const area = text.match(new RegExp(`(${NUM})\\s*[x×]\\s*(${NUM})`));
  if (area) {
    const [a, b] = [toNum(area[1]), toNum(area[2])];
    return {
      quantity: round2(a * b),
      unitOfMeasure: "mq",
      label: `${area[1]}x${area[2]}`,
    };
  }

  // Valore esplicito con unità  es. "25 mq", "12ml", "3 mc", "8 mq."
  const withUnit = text.match(new RegExp(`(${NUM})\\s*(mq|m2|mc|m3|ml|m\\.l\\.|mt|m)\\b`));
  if (withUnit) {
    const value = toNum(withUnit[1]);
    const raw = withUnit[2];
    const um =
      raw === "mq" || raw === "m2" ? "mq" :
      raw === "mc" || raw === "m3" ? "mc" :
      raw === "ml" || raw === "m.l." || raw === "mt" ? "ml" :
      "ml"; // "m" generico → metri lineari
    return { quantity: round2(value), unitOfMeasure: um, label: `${withUnit[1]} ${um}` };
  }

  // Diametro  es. "ø100", "diametro 100"
  const dia = text.match(new RegExp(`(?:ø|diametro\\s*)(${NUM})`));
  if (dia) {
    return { quantity: null, unitOfMeasure: null, label: `ø${dia[1]}` };
  }

  return { quantity: null, unitOfMeasure: null, label: null };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Etichette concise ────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "di", "del", "della", "dei", "delle", "degli", "dello", "da", "in", "con", "per",
  "su", "tra", "fra", "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "e",
  "ed", "al", "allo", "alla", "ai", "agli", "alle", "comprensivo", "compreso",
  "completo", "completa", "incluso", "inclusa", "eventuale", "eventuali", "relativo",
  "relativa", "apposito", "appositi", "mediante", "tramite", "circa", "ogni",
  "nonché", "nonche", "previo", "previa", "secondo", "come", "quanto", "necessario",
  "occorrente", "fornitura", "posa", "opera", "lavorazione",
]);

/**
 * Estrae da una descrizione verbosa un'etichetta concisa (max ~6 parole utili),
 * mantenendo le prime parole-chiave significative + eventuale misura in coda.
 * Usata come fallback quando l'AI non è disponibile.
 */
export function conciseLabel(description: string, maxWords = 6): string {
  const clean = description.trim().replace(/\s+/g, " ");
  const measure = extractMeasure(clean);

  // Rimuove i token di misura (AxBxC, AxB, "N mq", "øN") così non sporcano le
  // parole e non vengono spezzati da virgole/punti interni ai numeri.
  const stripped = clean
    .replace(new RegExp(`(${NUM})\\s*[x×]\\s*(${NUM})\\s*[x×]\\s*(${NUM})`, "gi"), " ")
    .replace(new RegExp(`(${NUM})\\s*[x×]\\s*(${NUM})`, "gi"), " ")
    .replace(new RegExp(`(${NUM})\\s*(mq|m2|mc|m3|ml|m\\.l\\.|mt)\\b`, "gi"), " ")
    .replace(new RegExp(`(?:ø|diametro\\s*)(${NUM})`, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim();

  // Prende la prima "frase" prima di virgola/punto e virgola/parentesi.
  const firstClause = stripped.split(/[;:(]|,(?!\d)/)[0].trim();

  const words = firstClause.split(" ").filter(Boolean);
  const kept: string[] = [];
  for (const w of words) {
    if (kept.length >= maxWords) break;
    const bare = w.toLowerCase().replace(/[^a-zàèéìòù0-9]/gi, "");
    // Mantiene la prima parola sempre (di solito il verbo/sostantivo chiave).
    if (kept.length === 0 || !STOPWORDS.has(bare)) kept.push(w);
  }

  let label = kept.join(" ").replace(/[\s,.;:]+$/, "");

  // Capitalizza la prima lettera.
  label = label.charAt(0).toUpperCase() + label.slice(1);

  // Appende la misura se non già presente nell'etichetta.
  if (measure.label && !label.toLowerCase().includes(measure.label.toLowerCase())) {
    label = `${label} ${measure.label}`;
  }
  return label;
}

// ─── Codici gerarchici ────────────────────────────────────────────────────────

/** Mappa categoria → prefisso codice (3 lettere). Estesa euristicamente. */
const CATEGORY_PREFIX: Record<string, string> = {
  pavimenti: "PAV",
  rivestimenti: "RIV",
  murature: "MUR",
  demolizioni: "DEM",
  intonaci: "INT",
  tinteggiature: "TIN",
  impianti: "IMP",
  "impianto elettrico": "ELE",
  "impianto idraulico": "IDR",
  idraulica: "IDR",
  elettrico: "ELE",
  termoidraulica: "TER",
  riscaldamento: "TER",
  cappotto: "CAP",
  isolamento: "ISO",
  impermeabilizzazioni: "IMP",
  serramenti: "SER",
  infissi: "SER",
  cartongesso: "CAR",
  controsoffitti: "CTS",
  opere: "OPE",
  "opere edili": "OPE",
  esterni: "EST",
  facciate: "FAC",
  coperture: "COP",
  tetto: "COP",
  bagno: "BAG",
  cucina: "CUC",
  scavi: "SCA",
  fondazioni: "FON",
  noleggi: "NOL",
  trasporti: "TRA",
  smaltimento: "SMA",
};

/**
 * Deduce un prefisso codice da categoria (o, in mancanza, dalla descrizione).
 * Default "GEN" (generico).
 */
export function codePrefix(category: string | null | undefined, description = ""): string {
  const cat = (category ?? "").toLowerCase().trim();
  if (cat && CATEGORY_PREFIX[cat]) return CATEGORY_PREFIX[cat];

  const haystack = `${cat} ${description}`.toLowerCase();
  for (const [key, prefix] of Object.entries(CATEGORY_PREFIX)) {
    if (haystack.includes(key)) return prefix;
  }
  return "GEN";
}

/**
 * Genera il prossimo codice gerarchico per un prefisso, dato l'elenco dei codici
 * già esistenti. Es. esistenti ["PAV.01","PAV.02"] + prefix "PAV" → "PAV.03".
 */
export function nextCode(prefix: string, existingCodes: (string | null)[]): string {
  let max = 0;
  const re = new RegExp(`^${prefix}\\.(\\d+)$`, "i");
  for (const c of existingCodes) {
    const m = c?.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}.${String(max + 1).padStart(2, "0")}`;
}
