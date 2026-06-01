import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { geminiFlash } from '@/lib/ai/gemini';
import { db } from '@/lib/db/client';
import { priceListItems } from '@/lib/db/schema';
import { ilike, or, eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '@/lib/env';

const schema = z.object({
  description: z.string().min(3).max(500),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('admin', 'editor');
  if (error) return error;

  if (!env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'AI non configurata' }, { status: 503 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Input non valido' }, { status: 400 });

  const { description } = parsed.data;

  const words = description.toLowerCase().split(' ').filter((w) => w.length > 3);
  const searchConditions = words.slice(0, 3).map((word) =>
    ilike(priceListItems.description, `%${word}%`)
  );

  const similarItems = await db
    .select()
    .from(priceListItems)
    .where(
      and(
        eq(priceListItems.isActive, true),
        searchConditions.length > 0 ? or(...searchConditions) : undefined
      )
    )
    .limit(10);

  const priceListContext =
    similarItems.length > 0
      ? `Voci simili nel listino prezzi aziendale:\n${similarItems
          .map(
            (item) =>
              `- "${item.description}" | U.M.: ${item.unitOfMeasure} | Prezzo: €${item.unitPrice}/u.m. | Categoria: ${item.category ?? 'N/D'}`
          )
          .join('\n')}`
      : 'Nessuna voce simile trovata nel listino aziendale.';

  const prompt = `Sei un assistente per un'impresa di ristrutturazioni edili italiana (Dieffe Ristrutturazioni Moncalieri).

L'utente sta creando una voce in un preventivo con questa descrizione:
"${description}"

${priceListContext}

Analizza la descrizione e suggerisci:
1. L'unità di misura più appropriata (scegli tra: mq, ml, mc, kg, n°, h, "a corpo", "vs.carico")
2. Il prezzo unitario consigliato in euro (basati sul listino se disponibile, altrimenti usa prezzi di mercato italiani attuali per lavori edili)
3. Una versione migliorata della descrizione (grammaticalmente corretta, professionale, chiara) - mantienila simile all'originale ma correggila

Rispondi SOLO con un JSON valido, nessun testo aggiuntivo:
{
  "unitOfMeasure": "mq",
  "unitPrice": 75.00,
  "improvedDescription": "descrizione migliorata",
  "confidence": "high|medium|low",
  "matchedFromPriceList": true,
  "notes": "breve nota opzionale sul suggerimento"
}`;

  try {
    const result = await Promise.race([
      geminiFlash.generateContent(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ]);

    const text = (result as Awaited<ReturnType<typeof geminiFlash.generateContent>>)
      .response.text()
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Risposta AI non valida');

    const suggestion = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ suggestion, similarItems: similarItems.slice(0, 3) });
  } catch (err) {
    console.error('[AI suggest-price] Gemini error:', err);
    return NextResponse.json({ error: 'Errore AI. Riprova.' }, { status: 500 });
  }
}
