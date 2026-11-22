import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Agente vocale sul preventivo (D1b sopralluogo + D1c comando vocale).
// L'IA riceve il preventivo (o la bozza) con un codice per ogni sezione (S1…)
// e voce (V1…) e il testo detto; risponde con operazioni che usano quei codici,
// così le modifiche colpiscono la voce giusta invece di indovinarla dal testo.
// Qui, puro e testato: istruzioni, rappresentazione del preventivo, validazione
// (codici esistenti, prezzi solo se detti — anche a parole —, testi ripuliti).
// ─────────────────────────────────────────────────────────────────────────────

export type AgentItem = { ref: string; text: string; quantity?: number | null; unit?: string | null; price?: number | null };
export type AgentSection = { ref: string; title: string; optional?: boolean; items: AgentItem[] };
export type AgentClient = {
  name: string;
  address?: string | null;
  vatNumber?: string | null;
  email?: string | null;
  phone?: string | null;
};
export type AgentQuote = {
  title?: string | null;
  client?: string | null;
  /** Dati del cliente (oltre al nome), se il preventivo ne ha uno. */
  clientInfo?: Omit<AgentClient, "name"> | null;
  address?: string | null;
  vatRate?: number | null;
  discountPercent?: number | null;
  validUntil?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  sections: AgentSection[];
};

const str = (max: number) => z.string().trim().min(1).max(max);
const num = (max: number) => z.number().finite().min(0).max(max);
const ref = z.string().trim().min(1).max(20);

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_section"), ref: ref.optional(), title: str(120), optional: z.boolean().optional() }),
  z.object({ op: z.literal("update_section"), section: ref, title: str(120).optional(), optional: z.boolean().optional() }),
  z.object({ op: z.literal("remove_section"), section: ref }),
  z.object({
    op: z.literal("add_item"),
    section: str(120),
    text: str(1200),
    quantity: num(1_000_000).nullable().optional(),
    unit: z.string().trim().max(20).nullable().optional(),
    price: num(10_000_000).nullable().optional(),
  }),
  z.object({
    op: z.literal("update_item"),
    item: ref,
    text: str(1200).optional(),
    quantity: num(1_000_000).nullable().optional(),
    unit: z.string().trim().max(20).nullable().optional(),
    price: num(10_000_000).nullable().optional(),
    /** Sposta la voce in un'altra sezione (codice o titolo). */
    section: str(120).optional(),
  }),
  z.object({ op: z.literal("remove_item"), item: ref }),
  z.object({ op: z.literal("add_note"), text: str(800) }),
  z.object({
    op: z.literal("set_client"),
    name: str(200),
    address: z.string().trim().max(300).nullable().optional(),
    vatNumber: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().max(200).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
  }),
  z.object({
    op: z.literal("update_client"),
    name: str(200).optional(),
    address: z.string().trim().max(300).nullable().optional(),
    vatNumber: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().max(200).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
  }),
  z.object({
    op: z.literal("set_quote"),
    title: str(200).optional(),
    vatRate: z.union([z.literal(0), z.literal(4), z.literal(10), z.literal(22)]).optional(),
    discountPercent: num(100).nullable().optional(),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    paymentTerms: z.string().trim().max(2000).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
  }),
]);

export type AgentOp = z.infer<typeof opSchema>;

// ── Numeri detti (cifre e parole) ────────────────────────────────────────────

const UNITS: Record<string, number> = {
  zero: 0, un: 1, uno: 1, una: 1, due: 2, tre: 3, "tré": 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9,
  dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16,
  diciassette: 17, diciotto: 18, diciannove: 19,
};
const TENS: [string, number][] = [
  ["venti", 20], ["vent", 20], ["trenta", 30], ["trent", 30], ["quaranta", 40], ["quarant", 40],
  ["cinquanta", 50], ["cinquant", 50], ["sessanta", 60], ["sessant", 60], ["settanta", 70], ["settant", 70],
  ["ottanta", 80], ["ottant", 80], ["novanta", 90], ["novant", 90],
];

/** Un numero scritto a parole in una sola parola ("milleduecentoquarantacinque"), o null. */
export function italianWordNumber(word: string): number | null {
  const w = word.toLowerCase().normalize("NFC");
  if (!w || !/^[a-zàèéìòù]+$/.test(w)) return null;
  const parse = (s: string): number | null => {
    if (s === "") return 0;
    if (s in UNITS) return UNITS[s];
    const mila = s.indexOf("mila");
    if (mila > 0) {
      const left = parse(s.slice(0, mila));
      const right = parse(s.slice(mila + 4));
      return left != null && left > 1 && right != null ? left * 1000 + right : null;
    }
    if (s.startsWith("mille")) {
      const right = parse(s.slice(5));
      return right != null ? 1000 + right : null;
    }
    const cento = s.indexOf("cento");
    if (cento >= 0) {
      const head = s.slice(0, cento);
      const left = head === "" ? 1 : parse(head);
      const right = parse(s.slice(cento + 5));
      return left != null && left < 10 && right != null && right < 100 ? left * 100 + right : null;
    }
    for (const [prefix, value] of TENS) {
      if (s.startsWith(prefix)) {
        const rest = s.slice(prefix.length);
        if (rest === "") return value;
        // "ventuno", "trentotto": la vocale finale cade davanti a uno/otto.
        const unit = rest in UNITS ? UNITS[rest] : null;
        return unit != null && unit > 0 && unit < 10 ? value + unit : null;
      }
    }
    return null;
  };
  return parse(w);
}

/** Tutti i numeri detti: in cifre ("1.200,50", "45") e a parole ("quarantacinque virgola cinque"). */
export function spokenNumbers(spoken: string): number[] {
  const out: number[] = [];
  for (const m of spoken.matchAll(/\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g)) {
    const raw = m[0];
    const normalized = /\d[.\s]\d{3}/.test(raw) ? raw.replace(/[.\s]/g, "").replace(",", ".") : raw.replace(",", ".");
    const n = Number(normalized);
    if (Number.isFinite(n)) out.push(n);
  }
  const words = spoken.toLowerCase().split(/[^a-zàèéìòù]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const n = italianWordNumber(words[i]);
    if (n == null || words[i] === "un" || words[i] === "una") continue;
    // "quarantacinque virgola cinquanta" → 45,5
    if (words[i + 1] === "virgola" && words[i + 2]) {
      const dec = italianWordNumber(words[i + 2]);
      if (dec != null) {
        out.push(Number(`${n}.${dec}`));
        i += 2;
        continue;
      }
    }
    out.push(n);
  }
  return out;
}

/** Il prezzo passa solo se il numero è stato detto (in cifre o a parole). */
export function priceWasSpoken(price: number, spoken: string): boolean {
  return spokenNumbers(spoken).some((n) => Math.abs(n - price) < 0.005);
}

/** Unità scritte come nei preventivi dell'impresa. */
export function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  const map: Record<string, string> = {
    mq: "m²", m2: "m²", "m²": "m²", "metri quadri": "m²", "metri quadrati": "m²", "metro quadro": "m²",
    ml: "m", m: "m", "metri lineari": "m", "metro lineare": "m", metri: "m", metro: "m",
    mc: "m³", m3: "m³", "m³": "m³", "metri cubi": "m³", "metro cubo": "m³",
    pz: "pz", pezzi: "pz", pezzo: "pz", "n°": "pz", n: "pz", nr: "pz", numero: "pz",
    corpo: "a corpo", "a corpo": "a corpo", ac: "a corpo",
    h: "h", ore: "h", ora: "h",
    kg: "kg", chili: "kg", chilo: "kg",
  };
  return map[u] ?? unit.trim().slice(0, 20);
}

// ── Preventivo per l'IA ──────────────────────────────────────────────────────

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace(".", ",");
}

export function quoteForPrompt(q: AgentQuote): string {
  const lines: string[] = [];
  lines.push(`Titolo: ${q.title || "(nessuno)"}`);
  if (q.client) {
    const c = q.clientInfo;
    const extra = c ? [c.address && `indirizzo ${c.address}`, c.phone && `tel. ${c.phone}`, c.email && `email ${c.email}`, c.vatNumber && `P.IVA/CF ${c.vatNumber}`].filter(Boolean).join(", ") : "";
    lines.push(`Cliente: ${q.client}${extra ? ` (${extra})` : ""}`);
  } else lines.push("Cliente: (nessuno)");
  if (q.address) lines.push(`Indirizzo cantiere: ${q.address}`);
  if (q.vatRate != null) lines.push(`IVA: ${q.vatRate}%`);
  if (q.discountPercent) lines.push(`Sconto: ${fmt(q.discountPercent)}%`);
  if (q.validUntil) lines.push(`Valido fino al: ${q.validUntil}`);
  if (q.paymentTerms) lines.push(`Pagamenti: ${q.paymentTerms.replace(/\s+/g, " ").slice(0, 300)}`);
  if (q.notes) lines.push(`Note generali: ${q.notes.replace(/\s+/g, " ").slice(0, 600)}`);
  if (!q.sections.length) lines.push("Sezioni: (nessuna)");
  for (const s of q.sections) {
    lines.push(`[${s.ref}] Sezione «${s.title}»${s.optional ? " (OPZIONALE)" : ""}`);
    if (!s.items.length) lines.push("   (vuota)");
    for (const i of s.items) {
      const parts = [i.quantity != null ? `${fmt(i.quantity)} ${i.unit ?? ""}`.trim() : i.unit, i.price ? `${fmt(i.price)} €/u` : "prezzo da definire"]
        .filter(Boolean)
        .join(" · ");
      // Descrizioni accorciate: all'IA basta riconoscere la voce (meno token).
      lines.push(`   [${i.ref}] ${i.text.replace(/\s+/g, " ").slice(0, 140)} — ${parts}`);
    }
  }
  return lines.join("\n");
}

// ── Validazione ──────────────────────────────────────────────────────────────

/**
 * Valida le operazioni dell'IA contro il preventivo: codici di sezione/voce
 * esistenti (o sezioni appena create nella stessa risposta), prezzi solo se
 * detti, unità normalizzate. Le operazioni non valide si scartano.
 */
export function sanitizeAgentOps(raw: unknown, spoken: string, quote: AgentQuote, max = 40): AgentOp[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { ops?: unknown }).ops)
      ? (raw as { ops: unknown[] }).ops
      : [];
  const sectionRefs = new Set(quote.sections.map((s) => s.ref.toUpperCase()));
  const sectionTitles = new Set(quote.sections.map((s) => s.title.toLowerCase()));
  const itemRefs = new Set(quote.sections.flatMap((s) => s.items.map((i) => i.ref.toUpperCase())));
  const ops: AgentOp[] = [];
  for (const entry of list.slice(0, max)) {
    const parsed = opSchema.safeParse(entry);
    if (!parsed.success) continue;
    const op = parsed.data;
    switch (op.op) {
      case "add_section":
        if (op.ref) sectionRefs.add(op.ref.toUpperCase());
        sectionTitles.add(op.title.toLowerCase());
        break;
      case "update_section":
      case "remove_section":
        if (!sectionRefs.has(op.section.toUpperCase())) continue;
        break;
      case "update_item":
      case "remove_item":
        if (!itemRefs.has(op.item.toUpperCase())) continue;
        break;
    }
    if ((op.op === "add_item" || op.op === "update_item") && op.price != null && !priceWasSpoken(op.price, spoken)) {
      if (op.op === "update_item") {
        // Un aggiornamento solo-prezzo con un prezzo non detto non ha senso: via.
        delete (op as { price?: number | null }).price;
      } else op.price = null;
    }
    if ((op.op === "add_item" || op.op === "update_item") && op.unit) op.unit = normalizeUnit(op.unit);
    if (op.op === "update_client" && !quote.client && !ops.some((o) => o.op === "set_client")) continue;
    if ((op.op === "set_client" || op.op === "update_client") && op.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(op.email)) {
      delete (op as { email?: string | null }).email;
    }
    if (op.op === "set_quote" && op.discountPercent != null && !priceWasSpoken(op.discountPercent, spoken)) {
      delete (op as { discountPercent?: number | null }).discountPercent;
    }
    ops.push(op);
  }
  return ops;
}

// ── Istruzioni ───────────────────────────────────────────────────────────────

export function agentSystemPrompt(mode: "survey" | "command") {
  const context =
    mode === "survey"
      ? `Stai assistendo un tecnico durante un SOPRALLUOGO: parla mentre gira il cantiere e il preventivo si costruisce da solo. Ricevi il preventivo attuale e SOLO il nuovo testo appena detto (trascrizione automatica: può avere errori di riconoscimento, interpretali con buon senso).
Frasi di contorno, ragionamenti ad alta voce, saluti, ripetizioni di cose già nel preventivo → nessuna operazione. Aggiungi voci SOLO per lavorazioni che il tecnico indica davvero come da fare.`
      : `Il tecnico ti dà un COMANDO A VOCE su un preventivo esistente (trascrizione automatica: può avere errori, interpretali con buon senso). Esegui esattamente quello che chiede, niente di più: se chiede di modificare, modifica la voce giusta; se chiede di aggiungere, aggiungi.`;
  return `Sei l'assistente esperto di un'impresa edile italiana (Dieffe Ristrutturazioni, Torino) e conosci bene i preventivi di ristrutturazione.
${context}

Il preventivo ti arriva con un codice per ogni sezione ([S1], [S2]…) e per ogni voce ([V1], [V2]…). Per modificare, spostare o togliere USA SEMPRE il codice esatto della voce o sezione a cui si riferisce il tecnico (capisci quale dal significato: "il pavimento" = la voce di posa/demolizione del pavimento, "la seconda voce", "quella del bagno"…).

Rispondi SOLO con JSON {"ops":[...]}. Operazioni possibili:
- {"op":"add_section","ref":"N1","title":"Opere opzionali","optional":true} — nuova sezione. "optional":true per lavori proposti come extra facoltativi ("in opzione", "se il cliente vuole", "come alternativa", "a parte"). "ref" è un codice nuovo (N1, N2…) che puoi usare subito nelle voci successive.
- {"op":"update_section","section":"S2","title":"…","optional":true|false} — rinomina o rende opzionale/non opzionale.
- {"op":"remove_section","section":"S2"} — solo se il tecnico chiede di togliere tutta la sezione.
- {"op":"add_item","section":"S1 o N1 o titolo nuovo","text":"descrizione","quantity":30,"unit":"m²","price":45} — nuova voce. "text": descrizione tecnica completa e professionale come in un preventivo vero (materiali, modalità, cosa è compreso), senza prezzi. Sezione: usa quella esistente adatta (codice), altrimenti crea la sezione con add_section prima. Sezioni brevi e tipiche: Demolizioni e rimozioni, Murature e tramezzi, Impianto elettrico, Impianto idraulico, Pavimenti e rivestimenti, Intonaci e pitture, Serramenti, Opere varie…
- {"op":"update_item","item":"V3","text":"…","quantity":…,"unit":"…","price":…,"section":"S2"} — metti SOLO i campi da cambiare.
- {"op":"remove_item","item":"V3"}
- {"op":"add_note","text":"…"} — osservazioni che non sono lavorazioni (stato dei luoghi, problemi, accessi, cose da verificare, richieste del cliente).
- {"op":"set_client","name":"Mario Rossi","address":"…","phone":"…","email":"…","vatNumber":"…"} — il cliente del preventivo diventa questo (se esiste già con quel nome si usa quello, altrimenti si crea). Solo quando il tecnico indica il cliente ("il cliente è…", "è per la signora Bianchi").
- {"op":"update_client","name":"…","address":"…","phone":"…","email":"…","vatNumber":"…"} — corregge o completa i dati del cliente ATTUALE (telefono, email, indirizzo, P.IVA/codice fiscale, nome scritto male). Solo i campi detti.
- {"op":"set_quote","title":"…","vatRate":10,"discountPercent":5,"validUntil":"AAAA-MM-GG","paymentTerms":"…","address":"…"} — dati generali, solo i campi detti. IVA solo 0, 4, 10 o 22. Titolo solo se manca o se il tecnico lo chiede.

Regole importanti:
- PREZZI: un prezzo detto ("a 45 euro al metro", "quarantacinque euro", "1500 a corpo") va SEMPRE nel campo "price" della voce a cui si riferisce (prezzo unitario; se è "a corpo" metti quantity 1 e unit "a corpo"). Se il tecnico non dice un prezzo, "price" resta null: mai stimare né inventare.
- Dati del cliente (telefono, email, P.IVA, indirizzo) solo se detti esattamente: mai inventarli. L'indirizzo del cantiere va in set_quote.address, quello del cliente in set_client/update_client.
- Quantità e unità solo se dette (m², m, m³, pz, h, kg, a corpo).
- Una frase che corregge una voce esistente ("no, sono 40 metri", "mettici 50 euro", "togli la demolizione") → update_item/remove_item su quella voce, NON una voce nuova.
- Mai duplicare voci o note già presenti.
- Se il testo non richiede nulla, rispondi {"ops":[]}.`;
}
