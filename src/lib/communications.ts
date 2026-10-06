import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Comunicazioni su carta intestata: costanti e validazione condivise tra
// editor (client), API e template PDF.
// ─────────────────────────────────────────────────────────────────────────────

export const RECIPIENT_KINDS = [
  { value: "cliente", label: "Cliente", salutation: "Spett.le" },
  { value: "condomini", label: "Condòmini", salutation: "Gent.mi Condòmini" },
  { value: "amministratore", label: "Amministratore", salutation: "Spett.le Amministrazione" },
  { value: "architetto", label: "Architetto / D.L.", salutation: "Egr. Arch." },
  { value: "altro", label: "Altro", salutation: "Alla c.a." },
] as const;

export type RecipientKind = (typeof RECIPIENT_KINDS)[number]["value"];

export function recipientKindLabel(kind: string): string {
  return RECIPIENT_KINDS.find((k) => k.value === kind)?.label ?? "Destinatario";
}

/** Dimensioni del testo in punti tipografici: identiche in editor e PDF. */
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32] as const;
export const DEFAULT_FONT_SIZE = 11;

/** Famiglie disponibili: i 3 font standard PDF, nessun file da incorporare. */
export const FONT_FAMILIES = [
  { value: "", label: "Sans (Helvetica)", css: "Helvetica, Arial, sans-serif", pdf: "Helvetica" },
  { value: "Times", label: "Serif (Times)", css: "'Times New Roman', Times, serif", pdf: "Times-Roman" },
  { value: "Courier", label: "Mono (Courier)", css: "'Courier New', Courier, monospace", pdf: "Courier" },
] as const;

export const TEXT_COLORS = [
  "#16181d", "#4b5563", "#1e40af", "#2563eb", "#059669",
  "#b45309", "#dc2626", "#7c3aed", "#db2777",
] as const;

export const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"] as const;

// ─── Documento Tiptap ────────────────────────────────────────────────────────

export interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface PMNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: PMMark[];
  content?: PMNode[];
}

export const EMPTY_DOC: PMNode = { type: "doc", content: [{ type: "paragraph" }] };

/** True se il documento non contiene testo. */
export function isDocEmpty(doc: PMNode | null | undefined): boolean {
  const walk = (n: PMNode): boolean =>
    (n.type === "text" && !!n.text?.trim()) || (n.content ?? []).some(walk);
  return !doc || !walk(doc);
}

/** Testo semplice del documento (anteprime nell'archivio). */
export function docToPlain(doc: PMNode | null | undefined): string {
  const out: string[] = [];
  const walk = (n: PMNode) => {
    if (n.type === "text") out.push(n.text ?? "");
    else if (n.type === "hardBreak") out.push(" ");
    (n.content ?? []).forEach(walk);
    if (["paragraph", "heading", "listItem"].includes(n.type)) out.push(" ");
  };
  if (doc) walk(doc);
  return out.join("").replace(/\s+/g, " ").trim();
}

// ─── Validazione API ─────────────────────────────────────────────────────────

const pmNode: z.ZodType<PMNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    text: z.string().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    marks: z
      .array(z.object({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional() }))
      .optional(),
    content: z.array(pmNode).optional(),
  })
);

export const recipientSchema = z.object({
  kind: z.string().max(40),
  salutation: z.string().max(120),
  name: z.string().max(200),
  address: z.string().max(400).optional(),
  email: z.string().max(200).optional(),
  clientId: z.string().nullable().optional(),
});

export const communicationInputSchema = z.object({
  subject: z.string().max(300),
  body: pmNode,
  recipients: z.array(recipientSchema).max(20),
  place: z.string().max(120).nullable().optional(),
  documentDate: z.string().max(20).nullable().optional(),
  includeStamp: z.boolean(),
  signatory: z.string().max(200).nullable().optional(),
});

export type CommunicationInput = z.infer<typeof communicationInputSchema>;
