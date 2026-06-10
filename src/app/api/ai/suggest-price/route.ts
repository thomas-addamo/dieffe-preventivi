import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { generateAIJson, isAiConfigured } from '@/lib/ai/client';
import { buildPriceIntel } from '@/lib/ai/rag';
import { extractMeasure, conciseLabel } from '@/lib/ai/parse';
import { z } from 'zod';

const schema = z.object({
  description: z.string().min(3).max(500),
});

export interface PriceSuggestion {
  unitOfMeasure: string;
  unitPrice: number;
  shortLabel: string;        // etichetta concisa, es. "Rifacimento pavimento 3x3"
  improvedDescription: string;
  suggestedQuantity: number | null;
  confidence: 'high' | 'medium' | 'low';
  priceSource: 'listino' | 'storico' | 'mercato';
  priceRange: { min: number; max: number } | null;
  reasoning: string;         // PERCHÉ questo prezzo (mostrato nella tendina)
  matchedFromPriceList: boolean;
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('admin', 'editor');
  if (error) return error;

  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'AI non configurata' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Input non valido' }, { status: 400 });

  const { description } = parsed.data;

  // 1) Intelligenza prezzo dai dati reali (listino + storico preventivi).
  const intel = await buildPriceIntel(description).catch(() => null);
  // 2) Misura estratta localmente (gratis, deterministica).
  const measure = extractMeasure(description);

  const listinoCtx =
    intel && intel.listino.length > 0
      ? `LISTINO AZIENDALE (voci simili):\n${intel.listino
          .map((i) => `- "${i.description}" | ${i.unitOfMeasure} | €${i.unitPrice}${i.code ? ` | cod ${i.code}` : ''}`)
          .join('\n')}`
      : 'LISTINO: nessuna voce simile.';

  const historyCtx =
    intel && intel.history.length > 0
      ? `STORICO PREVENTIVI (più recenti prima):\n${intel.history
          .slice(0, 8)
          .map((i) => `- "${i.description}" | €${i.unitPrice}/${i.unitOfMeasure} | ${i.quoteCode} – ${i.clientName ?? 'N/D'} – ${i.date ?? 'N/D'}`)
          .join('\n')}`
      : 'STORICO: nessun precedente.';

  const statsCtx = intel?.stats
    ? `STATISTICHE STORICHE: ${intel.stats.count} precedenti, min €${intel.stats.min}, max €${intel.stats.max}, media €${intel.stats.avg}, ultimo €${intel.stats.lastPrice} (${intel.stats.lastDate}).`
    : 'STATISTICHE: nessun dato storico.';

  const measureCtx = measure.label
    ? `MISURA RILEVATA nella descrizione: "${measure.label}"${measure.quantity ? ` → quantità ${measure.quantity} ${measure.unitOfMeasure}` : ''}.`
    : 'MISURA: nessuna misura esplicita nella descrizione.';

  const system = `Sei un computista esperto di edilizia italiana (Dieffe Ristrutturazioni, Torino). Suggerisci voce di preventivo basandoti PRIMA sui dati aziendali reali forniti, poi sul mercato.

PRIORITÀ PREZZO: 1) listino aziendale → 2) media storica preventivi → 3) prezzo di mercato italiano. Indica la fonte usata.

ETICHETTA "shortLabel": breve e parlante (max 6 parole), con la misura se presente. NON copiare descrizioni lunghe da capitolato.
Esempio: da "Fornitura e posa in opera di pavimentazione in gres porcellanato..." → "Posa gres porcellanato 3x3".

UNITÀ: scegli tra mq, ml, mc, kg, n°, h, "a corpo", "vs.carico". Coerente con la misura rilevata.

Rispondi SOLO con JSON valido:
{
  "unitOfMeasure": "mq",
  "unitPrice": 75.00,
  "shortLabel": "Posa gres 3x3",
  "improvedDescription": "descrizione professionale chiara, corretta",
  "suggestedQuantity": 9,
  "confidence": "high|medium|low",
  "priceSource": "listino|storico|mercato",
  "priceRange": { "min": 65, "max": 90 },
  "reasoning": "1-2 frasi: PERCHÉ questo prezzo e questa U.M., citando i dati usati (es. 'media di 3 preventivi 2025' o 'voce listino PAV.02')",
  "matchedFromPriceList": true
}`;

  const user = `Voce da analizzare: "${description}"

${measureCtx}
${statsCtx}
${listinoCtx}
${historyCtx}`;

  try {
    const s = await generateAIJson<Partial<PriceSuggestion>>(system, user);

    // Sanitizza + integra con i dati deterministici locali.
    const suggestion: PriceSuggestion = {
      unitOfMeasure: typeof s.unitOfMeasure === 'string' ? s.unitOfMeasure : (measure.unitOfMeasure ?? 'a corpo'),
      unitPrice: Number(s.unitPrice) || 0,
      shortLabel: (s.shortLabel?.trim() || conciseLabel(description)).slice(0, 80),
      improvedDescription: s.improvedDescription?.trim() || description,
      suggestedQuantity:
        s.suggestedQuantity != null && Number(s.suggestedQuantity) > 0
          ? Number(s.suggestedQuantity)
          : measure.quantity,
      confidence: (['high', 'medium', 'low'].includes(s.confidence as string) ? s.confidence : 'medium') as PriceSuggestion['confidence'],
      priceSource: (['listino', 'storico', 'mercato'].includes(s.priceSource as string) ? s.priceSource : 'mercato') as PriceSuggestion['priceSource'],
      priceRange:
        s.priceRange && Number(s.priceRange.min) > 0 && Number(s.priceRange.max) > 0
          ? { min: Number(s.priceRange.min), max: Number(s.priceRange.max) }
          : intel?.stats
            ? { min: intel.stats.min, max: intel.stats.max }
            : null,
      reasoning: s.reasoning?.trim() || 'Stima basata su prezzi di mercato edili italiani.',
      matchedFromPriceList: !!s.matchedFromPriceList || (intel?.listino.length ?? 0) > 0,
    };

    if (suggestion.unitPrice <= 0) throw new Error('Prezzo non valido');

    return NextResponse.json({
      suggestion,
      similarItems: intel?.listino.slice(0, 3) ?? [],
    });
  } catch (err) {
    const e = err as { message?: string; status?: number };
    console.error('[AI suggest-price] status=' + (e.status ?? '?') + ' msg=' + (e.message ?? String(err)).slice(0, 200));
    return NextResponse.json({ error: 'Errore AI. Riprova.' }, { status: 500 });
  }
}
