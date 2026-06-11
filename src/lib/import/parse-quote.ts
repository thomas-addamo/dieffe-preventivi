// ─────────────────────────────────────────────────────────────────────────────
// Interpretazione AI del testo estratto da un file di preventivo: trasforma
// testo grezzo in una struttura ParsedQuote pronta per l'anteprima/creazione.
// ─────────────────────────────────────────────────────────────────────────────

import { generateAIJson } from "@/lib/ai/client";

export interface ParsedQuoteItem {
  description: string;
  unitOfMeasure: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface ParsedQuoteSection {
  title: string;
  description: string | null;
  /** Prezzo a corpo dell'intera sezione (le voci non hanno prezzi singoli). */
  lumpSumPrice: number | null;
  items: ParsedQuoteItem[];
}

export interface ParsedQuoteClient {
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
}

export interface ParsedQuote {
  title: string;
  client: ParsedQuoteClient | null;
  projectAddress: string | null;
  vatRate: number | null;
  validUntil: string | null;
  paymentTerms: string | null;
  notes: string | null;
  declaredSubtotal: number | null;
  declaredTotal: number | null;
  sections: ParsedQuoteSection[];
}

export class QuoteParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteParseError";
  }
}

const MAX_SECTIONS = 40;
const MAX_ITEMS = 300;

const SYSTEM_PROMPT = `Sei un sistema di estrazione dati per preventivi edili italiani (impresa Dieffe Ristrutturazioni).
Ricevi il testo grezzo estratto da un file (PDF, Word, Excel...) che contiene un preventivo esistente.
Estrai i dati e rispondi SOLO con JSON valido, esattamente in questa struttura:

{
  "title": "titolo breve del preventivo (oggetto dei lavori, max 10 parole)",
  "client": { "name": "...", "address": null, "email": null, "phone": null, "vatNumber": null } oppure null se nessun cliente è indicato,
  "projectAddress": "indirizzo del cantiere/immobile" oppure null,
  "vatRate": 22 (aliquota IVA in % se indicata nel documento, altrimenti null),
  "validUntil": "YYYY-MM-DD" (scadenza/validità offerta se indicata, altrimenti null),
  "paymentTerms": "condizioni di pagamento testuali" oppure null,
  "notes": "note/esclusioni/condizioni generali rilevanti" oppure null,
  "declaredSubtotal": 10000.00 (imponibile/totale IVA esclusa dichiarato nel documento, altrimenti null),
  "declaredTotal": 12200.00 (totale finale IVA inclusa dichiarato nel documento, altrimenti null),
  "sections": [
    {
      "title": "nome capitolo/categoria (es. Demolizioni, Impianto idraulico)",
      "description": null,
      "lumpSumPrice": null,
      "items": [
        { "description": "voce di lavorazione", "unitOfMeasure": "mq", "quantity": 25, "unitPrice": 12.50, "discount": 0 }
      ]
    }
  ]
}

REGOLE:
- Estrai TUTTE le voci di lavorazione/fornitura, senza riassumerle o accorparle. Ogni riga/frase che descrive un lavoro distinto è una voce separata, ANCHE SE NON HA UN PREZZO PROPRIO.
- PREZZO A CORPO DI SEZIONE: se il documento indica un unico prezzo per un intero capitolo/sezione (le singole lavorazioni elencate non hanno prezzi propri), imposta "lumpSumPrice" della sezione con quell'importo ed estrai comunque TUTTE le lavorazioni elencate come voci con unitPrice 0. NON fondere le lavorazioni in un'unica voce.
- Se le voci hanno prezzi propri, "lumpSumPrice" resta null.
- NON includere tra le voci le righe di subtotale, totale, IVA, sconto complessivo o intestazioni.
- Numeri in formato italiano ("1.234,56") → converti in decimale con punto (1234.56).
- Se una riga ha solo l'importo totale: unitPrice = importo / quantità; se la quantità manca usa quantity 1, unitOfMeasure "a corpo" e unitPrice = importo.
- "discount" è lo sconto % della singola voce se indicato, altrimenti 0.
- unitOfMeasure: usa quella del documento; se assente scegli tra mq, ml, mc, kg, n°, h, "a corpo".
- Raggruppa le voci nei capitoli/sezioni del documento; se il documento non ha capitoli usa un'unica sezione "Lavori".
- Non inventare dati: usa null per ciò che non è presente nel documento.
- I dati del cliente sono il DESTINATARIO del preventivo, non l'impresa che lo emette.`;

function cleanStr(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

/** Accetta anche numeri in formato italiano ("1.234,56" → 1234.56). */
function cleanNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[€\s]/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Normalizza e valida l'output AI: scarta voci vuote, clampa i numeri. */
function sanitize(raw: Record<string, unknown>): ParsedQuote {
  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
  let itemCount = 0;

  const sections: ParsedQuoteSection[] = [];
  for (const s of rawSections.slice(0, MAX_SECTIONS)) {
    if (!s || typeof s !== "object") continue;
    const sec = s as Record<string, unknown>;
    const rawItems = Array.isArray(sec.items) ? sec.items : [];

    const items: ParsedQuoteItem[] = [];
    for (const it of rawItems) {
      if (itemCount >= MAX_ITEMS) break;
      if (!it || typeof it !== "object") continue;
      const item = it as Record<string, unknown>;
      const description = cleanStr(item.description);
      if (!description) continue;

      const quantity = cleanNum(item.quantity);
      const unitPrice = cleanNum(item.unitPrice);
      const discount = cleanNum(item.discount);
      items.push({
        description,
        unitOfMeasure: cleanStr(item.unitOfMeasure, 20) ?? "n°",
        quantity: quantity != null && quantity > 0 ? quantity : 1,
        unitPrice: unitPrice != null && unitPrice >= 0 ? unitPrice : 0,
        discount: discount != null ? Math.min(Math.max(discount, 0), 100) : 0,
      });
      itemCount++;
    }

    if (items.length === 0) continue;
    const lumpSumPrice = cleanNum(sec.lumpSumPrice);
    sections.push({
      title: cleanStr(sec.title, 200) ?? `Sezione ${sections.length + 1}`,
      description: cleanStr(sec.description, 1000),
      lumpSumPrice: lumpSumPrice != null && lumpSumPrice > 0 ? lumpSumPrice : null,
      items,
    });
  }

  if (sections.length === 0) {
    throw new QuoteParseError(
      "Nessuna voce di preventivo riconosciuta nel file. Verifica che il documento contenga un preventivo con lavorazioni e prezzi."
    );
  }

  const rawClient =
    raw.client && typeof raw.client === "object"
      ? (raw.client as Record<string, unknown>)
      : null;
  const clientName = rawClient ? cleanStr(rawClient.name, 200) : null;

  const vatRate = cleanNum(raw.vatRate);

  return {
    title: cleanStr(raw.title, 300) ?? "Preventivo importato",
    client: clientName
      ? {
          name: clientName,
          address: cleanStr(rawClient!.address, 300),
          email: cleanStr(rawClient!.email, 200),
          phone: cleanStr(rawClient!.phone, 50),
          vatNumber: cleanStr(rawClient!.vatNumber, 50),
        }
      : null,
    projectAddress: cleanStr(raw.projectAddress, 300),
    vatRate: vatRate != null && vatRate >= 0 && vatRate <= 100 ? vatRate : null,
    validUntil: cleanStr(raw.validUntil, 30),
    paymentTerms: cleanStr(raw.paymentTerms, 1000),
    notes: cleanStr(raw.notes, 2000),
    declaredSubtotal: cleanNum(raw.declaredSubtotal),
    declaredTotal: cleanNum(raw.declaredTotal),
    sections,
  };
}

/**
 * Interpreta il testo di un preventivo con l'AI e restituisce la struttura
 * normalizzata. Lancia QuoteParseError se il contenuto non è interpretabile.
 */
export async function parseQuoteFromText(text: string): Promise<ParsedQuote> {
  let raw: Record<string, unknown>;
  try {
    raw = await generateAIJson<Record<string, unknown>>(
      SYSTEM_PROMPT,
      `Testo del documento da analizzare:\n\n${text}`,
      50000,
      8000
    );
  } catch (err) {
    if (err instanceof QuoteParseError) throw err;
    throw new QuoteParseError(
      "L'AI non è riuscita a interpretare il contenuto del file. Riprova o usa un formato diverso."
    );
  }
  return sanitize(raw);
}
