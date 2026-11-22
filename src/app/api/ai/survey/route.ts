import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/permissions/guard";
import { aiDisabledResponse } from "@/lib/ai/guard";
import { generateAIJson, isAiConfigured } from "@/lib/ai/client";
import { agentSystemPrompt, quoteForPrompt, sanitizeAgentOps, type AgentQuote } from "@/lib/ai/quote-agent";

// Sopralluogo con IA vocale (D1b, solo iPhone): l'app manda il nuovo parlato e la
// bozza (con i codici S1…/V1…), l'IA risponde con le operazioni da fare.
// Niente nel database: la bozza vive sul telefono finché non si salva.

export const maxDuration = 30;

const item = z.object({
  ref: z.string().max(20),
  text: z.string().max(1200),
  quantity: z.number().nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  price: z.number().nullable().optional(),
});

const schema = z.object({
  text: z.string().trim().min(1).max(6000),
  draft: z.object({
    title: z.string().max(200).nullable().optional(),
    client: z
      .object({
        name: z.string().max(200),
        address: z.string().max(300).nullable().optional(),
        vatNumber: z.string().max(40).nullable().optional(),
        email: z.string().max(200).nullable().optional(),
        phone: z.string().max(40).nullable().optional(),
      })
      .nullable()
      .optional(),
    vatRate: z.number().nullable().optional(),
    discountPercent: z.number().nullable().optional(),
    paymentTerms: z.string().max(500).nullable().optional(),
    validUntil: z.string().max(20).nullable().optional(),
    sections: z
      .array(z.object({ ref: z.string().max(20), title: z.string().max(120), optional: z.boolean().optional(), items: z.array(item).max(200) }))
      .max(40),
    notes: z.array(z.string().max(800)).max(100),
  }),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole("admin", "editor");
  if (error) return error;
  const aiOff = await aiDisabledResponse();
  if (aiOff) return aiOff;
  if (!isAiConfigured()) return NextResponse.json({ error: "IA non configurata" }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  const { text, draft } = parsed.data;
  const quote: AgentQuote = {
    title: draft.title,
    client: draft.client?.name || null,
    clientInfo: draft.client ?? null,
    vatRate: draft.vatRate ?? undefined,
    discountPercent: draft.discountPercent,
    paymentTerms: draft.paymentTerms,
    validUntil: draft.validUntil,
    notes: draft.notes.length ? draft.notes.join(" · ") : null,
    sections: draft.sections,
  };

  const prompt = `PREVENTIVO ATTUALE:\n${quoteForPrompt(quote)}\n\nNUOVO TESTO DETTO:\n«${text}»`;
  try {
    const raw = await generateAIJson<unknown>(agentSystemPrompt("survey"), prompt, 20000, 1400, { smart: true });
    return NextResponse.json({ ops: sanitizeAgentOps(raw, text, quote) });
  } catch (err) {
    console.error("[sopralluogo] IA non riuscita:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "IA non disponibile, riprovo" }, { status: 502 });
  }
}
