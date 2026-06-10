import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { generateAIJson, isAiConfigured } from '@/lib/ai/client';
import { db } from '@/lib/db/client';
import { priceListItems } from '@/lib/db/schema';
import { ilike, eq, and } from 'drizzle-orm';
import { conciseLabel, extractMeasure, codePrefix, nextCode } from '@/lib/ai/parse';
import { z } from 'zod';

const itemSchema = z.object({
  description: z.string().max(2000),
  unitOfMeasure: z.string().max(20),
  unitPrice: z.number().finite(),
});

const schema = z.object({
  items: z.array(itemSchema).max(100),
});

interface AiCondensed {
  items: { shortLabel: string; category: string }[];
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole('admin', 'editor');
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ added: 0 });

  const candidates = parsed.data.items.filter(
    (i) => i.description.trim().length >= 15 && i.unitPrice > 0
  );
  if (candidates.length === 0) return NextResponse.json({ added: 0 });

  // 1) Condensazione intelligente: una sola chiamata AI per tutto il batch.
  //    Fallback euristico locale se l'AI non è disponibile/fallisce.
  let condensed: { shortLabel: string; category: string }[] = candidates.map((c) => ({
    shortLabel: conciseLabel(c.description),
    category: '',
  }));

  if (isAiConfigured()) {
    try {
      const list = candidates
        .map((c, i) => `${i + 1}. "${c.description}" (${c.unitOfMeasure}, €${c.unitPrice})`)
        .join('\n');
      const system = `Sei un computista edile. Per ogni voce di preventivo genera una versione da LISTINO: etichetta BREVE e parlante (max 6 parole, includi la misura se presente, es. "Posa gres 3x3") e una CATEGORIA edile standard (es. Pavimenti, Rivestimenti, Murature, Demolizioni, Intonaci, Tinteggiature, Impianto elettrico, Idraulica, Cappotto, Serramenti, Cartongesso, Opere edili). NON copiare descrizioni lunghe da capitolato.
Rispondi SOLO con JSON: {"items":[{"shortLabel":"...","category":"..."}]} nello stesso ordine, stessa lunghezza dell'elenco.`;
      const ai = await generateAIJson<AiCondensed>(system, list, 12000);
      if (ai?.items?.length === candidates.length) {
        condensed = ai.items.map((it, i) => ({
          shortLabel: (it.shortLabel?.trim() || conciseLabel(candidates[i].description)).slice(0, 80),
          category: it.category?.trim() || '',
        }));
      }
    } catch {
      // mantiene il fallback euristico
    }
  }

  // 2) Carica i codici già esistenti per generare la numerazione gerarchica.
  const existing = await db
    .select({ code: priceListItems.code, description: priceListItems.description })
    .from(priceListItems);
  const allCodes = existing.map((e) => e.code);

  let added = 0;
  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i];
    const { shortLabel, category } = condensed[i];

    // Dedup: salta se esiste già una voce con etichetta concisa equivalente.
    const dup = await db
      .select({ id: priceListItems.id })
      .from(priceListItems)
      .where(and(eq(priceListItems.isActive, true), ilike(priceListItems.description, shortLabel)))
      .limit(1);
    if (dup.length > 0) continue;

    // Codice gerarchico: prefisso per categoria + progressivo.
    const prefix = codePrefix(category, item.description);
    const code = nextCode(prefix, allCodes);
    allCodes.push(code);

    const measure = extractMeasure(item.description);
    const notes =
      `Appreso automaticamente da preventivo.` +
      (measure.label ? ` Misura: ${measure.label}.` : '') +
      ` Testo originale: ${item.description.trim()}`;

    await db.insert(priceListItems).values({
      code,
      description: shortLabel,
      unitOfMeasure: item.unitOfMeasure,
      unitPrice: String(item.unitPrice),
      category: category || 'Auto',
      notes: notes.slice(0, 1000),
      isActive: true,
      createdBy: session.user.id,
    });
    added++;
  }

  return NextResponse.json({ added });
}
