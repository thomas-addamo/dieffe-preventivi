import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { searchAll } from '@/lib/ai/rag';
import { generateAI, isAiConfigured } from '@/lib/ai/client';

export async function GET(req: NextRequest) {
  const { error } = await requireRole('admin', 'editor');
  if (error) return error;

  const q = new URL(req.url).searchParams.get('q') ?? '';
  if (q.trim().length < 2) {
    return NextResponse.json({ quoteItems: [], listinoItems: [], summary: '' });
  }

  const { quoteItems, listinoItems } = await searchAll(q).catch(() => ({
    quoteItems: [],
    listinoItems: [],
  }));

  let summary = '';
  if (isAiConfigured() && (quoteItems.length > 0 || listinoItems.length > 0)) {
    const ctx = [
      listinoItems.length > 0
        ? `Listino prezzi:\n${listinoItems.map((i) => `- "${i.description}" | ${i.unitOfMeasure} | €${i.unitPrice}`).join('\n')}`
        : '',
      quoteItems.length > 0
        ? `Preventivi storici (più recenti prima):\n${quoteItems
            .slice(0, 8)
            .map(
              (i) =>
                `- "${i.description}" | €${i.unitPrice}/${i.unitOfMeasure} | ` +
                `${i.quoteCode} – ${i.clientName ?? 'N/D'} – ${i.quoteDate?.substring(0, 10)}`
            )
            .join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const prompt = `Dati trovati nel sistema per la ricerca "${q}":\n\n${ctx}\n\nFornisci una risposta sintetica (2-3 righe max) che risponde alla domanda/ricerca dell'utente usando questi dati reali. Indica i prezzi trovati. Sii diretto.`;

    summary = await generateAI(prompt, 8000).catch(() => '');
  }

  return NextResponse.json({ quoteItems, listinoItems, summary });
}
