import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/permissions/guard";
import { aiDisabledResponse } from "@/lib/ai/guard";
import { generateAIJson, isAiConfigured } from "@/lib/ai/client";
import { SURVEY_SYSTEM_PROMPT, draftForPrompt, sanitizeSurveyOps } from "@/lib/ai/survey";

// Sopralluogo con IA vocale (D1b, solo iPhone): l'app manda il nuovo parlato e la
// bozza attuale, l'IA risponde con le operazioni da fare (vedi lib/ai/survey.ts).
// Niente nel database: la bozza vive sul telefono finché non si salva.

export const maxDuration = 30;

const item = z.object({
  text: z.string().max(600),
  quantity: z.number().nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  price: z.number().nullable().optional(),
});

const schema = z.object({
  text: z.string().trim().min(1).max(6000),
  draft: z.object({
    title: z.string().max(200).nullable().optional(),
    sections: z.array(z.object({ title: z.string().max(80), items: z.array(item).max(200) })).max(40),
    notes: z.array(z.string().max(500)).max(100),
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

  const prompt = `BOZZA ATTUALE:\n${draftForPrompt(draft)}\n\nNUOVO TESTO DETTO:\n«${text}»`;
  try {
    const raw = await generateAIJson<unknown>(SURVEY_SYSTEM_PROMPT, prompt, 20000, 1800);
    return NextResponse.json({ ops: sanitizeSurveyOps(raw, text) });
  } catch (err) {
    console.error("[sopralluogo] IA non riuscita:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "IA non disponibile, riprovo" }, { status: 502 });
  }
}
