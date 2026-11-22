import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Sopralluogo con IA vocale (D1b): dal parlato alle operazioni sulla bozza.
// L'IA riceve solo il NUOVO testo e lo stato attuale della bozza, e risponde
// con poche operazioni precise. Qui la validazione, pura e testata:
//  • i prezzi passano solo se il numero compare davvero nel parlato (scelta
//    dell'utente: niente prezzi inventati o presi dal listino);
//  • testi ripuliti e accorciati, operazioni sconosciute scartate.
// ─────────────────────────────────────────────────────────────────────────────

export type SurveyDraft = {
  title?: string | null;
  sections: { title: string; items: { text: string; quantity?: number | null; unit?: string | null; price?: number | null }[] }[];
  notes: string[];
};

const text = (max: number) => z.string().trim().min(1).max(max);

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_item"),
    section: text(80),
    text: text(600),
    quantity: z.number().positive().max(1_000_000).nullable().optional(),
    unit: z.string().trim().max(20).nullable().optional(),
    price: z.number().positive().max(10_000_000).nullable().optional(),
  }),
  z.object({
    op: z.literal("update_item"),
    /** Testo (o parte) della voce da modificare. */
    match: text(200),
    text: z.string().trim().max(600).nullable().optional(),
    quantity: z.number().positive().max(1_000_000).nullable().optional(),
    unit: z.string().trim().max(20).nullable().optional(),
    price: z.number().positive().max(10_000_000).nullable().optional(),
  }),
  z.object({ op: z.literal("remove_item"), match: text(200) }),
  z.object({ op: z.literal("add_note"), text: text(500) }),
  z.object({ op: z.literal("set_title"), text: text(120) }),
]);

export type SurveyOp = z.infer<typeof opSchema>;

/** Numeri presenti nel parlato, scritti in cifre ("1.200,50", "1200", "45"). */
export function spokenNumbers(spoken: string): number[] {
  const out: number[] = [];
  for (const m of spoken.matchAll(/\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g)) {
    const raw = m[0];
    const normalized = /\d[.\s]\d{3}/.test(raw) ? raw.replace(/[.\s]/g, "").replace(",", ".") : raw.replace(",", ".");
    const n = Number(normalized);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Un prezzo è valido solo se l'utente l'ha detto (stesso numero nel testo nuovo). */
export function priceWasSpoken(price: number, spoken: string): boolean {
  return spokenNumbers(spoken).some((n) => Math.abs(n - price) < 0.005);
}

/** Valida le operazioni dell'IA; scarta quelle non valide e i prezzi non detti. */
export function sanitizeSurveyOps(raw: unknown, spoken: string, max = 20): SurveyOp[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { ops?: unknown }).ops) ? (raw as { ops: unknown[] }).ops : [];
  const ops: SurveyOp[] = [];
  for (const item of list.slice(0, max)) {
    const parsed = opSchema.safeParse(item);
    if (!parsed.success) continue;
    const op = parsed.data;
    if ((op.op === "add_item" || op.op === "update_item") && op.price != null && !priceWasSpoken(op.price, spoken)) {
      op.price = null;
    }
    if ((op.op === "add_item" || op.op === "update_item") && op.unit) op.unit = normalizeUnit(op.unit);
    ops.push(op);
  }
  return ops;
}

/** Unità scritte come le scrive l'impresa nei preventivi. */
export function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  const map: Record<string, string> = {
    mq: "m²", m2: "m²", "m²": "m²", "metri quadri": "m²", "metri quadrati": "m²",
    ml: "m", m: "m", "metri lineari": "m", metri: "m",
    mc: "m³", m3: "m³", "m³": "m³", "metri cubi": "m³",
    pz: "pz", pezzi: "pz", pezzo: "pz", n: "pz", nr: "pz",
    corpo: "a corpo", "a corpo": "a corpo", ac: "a corpo",
    h: "h", ore: "h", ora: "h",
    kg: "kg", chili: "kg",
  };
  return map[u] ?? unit.trim().slice(0, 20);
}

/** Bozza compatta da mandare all'IA (solo ciò che serve per decidere). */
export function draftForPrompt(draft: SurveyDraft): string {
  const lines: string[] = [];
  if (draft.title) lines.push(`Titolo: ${draft.title}`);
  for (const s of draft.sections) {
    lines.push(`Sezione «${s.title}»:`);
    for (const i of s.items) {
      const q = i.quantity ? ` — ${i.quantity} ${i.unit ?? ""}`.trimEnd() : i.unit ? ` — ${i.unit}` : "";
      const p = i.price ? ` — ${i.price} €` : "";
      lines.push(`  • ${i.text}${q}${p}`);
    }
  }
  if (draft.notes.length) lines.push("Note:", ...draft.notes.map((n) => `  • ${n}`));
  return lines.length ? lines.join("\n") : "(bozza vuota)";
}

export const SURVEY_SYSTEM_PROMPT = `Sei l'assistente di un'impresa edile italiana (Dieffe Ristrutturazioni, Torino) durante un SOPRALLUOGO.
Ricevi la bozza attuale del preventivo e il NUOVO testo appena detto a voce dal tecnico (trascrizione automatica: può avere errori).
Rispondi SOLO con JSON: {"ops":[...]} con le operazioni da fare sulla bozza per il NUOVO testo. Operazioni:
- {"op":"add_item","section":"Demolizioni","text":"Demolizione pavimento bagno","quantity":30,"unit":"m²","price":null} — una lavorazione da mettere in preventivo. "text" è la descrizione tecnica completa, chiara e professionale come in un preventivo (anche lunga se servono dettagli), senza prezzi. Sezioni brevi e coerenti (es. Demolizioni, Murature, Impianti, Pavimenti e rivestimenti, Pitture, Serramenti, Opere varie): riusa quelle già presenti.
- {"op":"update_item","match":"parte del testo della voce","quantity":...,"unit":"...","price":...,"text":"..."} — se il tecnico corregge una voce già presente.
- {"op":"remove_item","match":"parte del testo della voce"} — se dice di togliere una voce.
- {"op":"add_note","text":"..."} — osservazioni utili che NON sono lavorazioni (stato dei luoghi, problemi, accessi, cose da verificare, richieste del cliente).
- {"op":"set_title","text":"..."} — solo se la bozza non ha un titolo e il testo fa capire il lavoro (es. "Ristrutturazione bagno").
Regole:
- PREZZI: metti "price" SOLO se il tecnico dice esplicitamente un prezzo in euro per quella voce (es. "a 45 euro al metro"); altrimenti null. Mai stimare, mai inventare.
- Quantità e unità solo se dette (m², m, m³, pz, h, kg, "a corpo").
- Non ripetere voci o note già nella bozza. Frasi di contorno (saluti, indirizzo, "allora vediamo") → nessuna operazione.
- Se il nuovo testo non aggiunge nulla, rispondi {"ops":[]}.`;
