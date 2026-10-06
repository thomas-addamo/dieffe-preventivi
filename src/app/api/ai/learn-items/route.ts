import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { aiDisabledResponse } from '@/lib/ai/guard';
import { generateAIJson, isAiConfigured } from '@/lib/ai/client';
import { db } from '@/lib/db/client';
import { priceListItems, type PriceListItem } from '@/lib/db/schema';
import { conciseLabel } from '@/lib/ai/parse';
import { MAYBE_SAME, SAME_ITEM, SimilarityIndex } from '@/lib/price-list/similarity';
import { CATALOG, canonicalCategory, isCatalogCategory } from '@/lib/price-list/taxonomy';
import { renumberCodes } from '@/lib/price-list/maintenance';
import { inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Apprendimento dal preventivo appena salvato. Per ogni voce:
//  · è già nel listino (stessa lavorazione)  → aggiorna "ultimo utilizzo";
//  · è simile ma non è certo                → decide l'AI: stessa voce
//                                              (sostituisce/aggiorna) o nuova;
//  · è nuova                                 → entra nel listino con etichetta
//                                              breve, categoria e sottocategoria.
// Così il listino non accumula più quasi-doppioni a ogni salvataggio.
// ─────────────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  description: z.string().max(2000),
  unitOfMeasure: z.string().max(20),
  unitPrice: z.number().finite(),
});

const schema = z.object({
  items: z.array(itemSchema).max(150),
});

type In = z.infer<typeof itemSchema>;

interface AiLearn {
  matches?: { i: number; same: boolean }[];
  items?: { i: number; shortLabel: string; category: string; subcategory?: string }[];
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole('admin', 'editor');
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ added: 0, used: 0 });

  const listino = await db.select().from(priceListItems);
  const index = new SimilarityIndex<PriceListItem>();
  for (const it of listino) index.add(it, it.description, it.unitOfMeasure);

  const used = new Map<string, PriceListItem>();
  const ambiguous: { input: In; candidate: PriceListItem }[] = [];
  const fresh: In[] = [];
  const seen = new Set<string>();

  for (const input of parsed.data.items) {
    const text = input.description.trim();
    if (text.length < 3) continue;
    const key = `${text.toLowerCase()}|${input.unitOfMeasure}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const best = index.find(text, input.unitOfMeasure, MAYBE_SAME)[0];
    if (best && best.score >= SAME_ITEM) used.set(best.item.id, best.item);
    else if (best) ambiguous.push({ input, candidate: best.item });
    else if (text.length >= 15 && input.unitPrice > 0) fresh.push(input);
  }

  // ── AI: una sola chiamata per dubbi + nuove voci ──
  const aiOn = isAiConfigured() && !(await aiDisabledResponse());
  let ai: AiLearn = {};
  if (aiOn && (ambiguous.length || fresh.length)) {
    const cats = CATALOG.map((c) => c.name).join(', ');
    const system = `Sei il responsabile del listino di un'impresa edile.
A) "DUBBI": per ogni coppia decidi se la voce del preventivo è la STESSA lavorazione della voce di listino ("same": true) o diversa (materiale, formato, spessore, fornitura vs posa diversi → false).
B) "NUOVE": per ogni voce genera un'etichetta da listino BREVE (max 6 parole, con la misura se presente, es. "Posa gres 30x60"), una categoria tra: ${cats}; e una sottocategoria di 1-3 parole.
Rispondi SOLO con JSON: {"matches":[{"i":1,"same":true}],"items":[{"i":1,"shortLabel":"...","category":"...","subcategory":"..."}]}`;
    const prompt =
      `DUBBI:\n${ambiguous
        .map((a, i) => `${i + 1}. preventivo: "${a.input.description.slice(0, 300)}" (${a.input.unitOfMeasure}) ↔ listino: "${a.candidate.description}" (${a.candidate.unitOfMeasure})`)
        .join('\n') || '(nessuno)'}\n\nNUOVE:\n${fresh
        .map((f, i) => `${i + 1}. "${f.description.slice(0, 300)}" (${f.unitOfMeasure}, €${f.unitPrice})`)
        .join('\n') || '(nessuna)'}`;
    try {
      ai = await generateAIJson<AiLearn>(system, prompt, 15000, 120 * (ambiguous.length + fresh.length) + 300);
    } catch {
      ai = {};
    }
  }

  // Dubbi: senza risposta AI si considera "stessa voce" solo se molto vicina.
  ambiguous.forEach((a, i) => {
    const verdict = ai.matches?.find((m) => m.i === i + 1);
    const same = verdict ? verdict.same : false;
    if (same) used.set(a.candidate.id, a.candidate);
    else if (a.input.description.trim().length >= 15 && a.input.unitPrice > 0) fresh.push(a.input);
  });

  // Nuove voci (ricontrollando i doppioni sull'etichetta breve).
  const toInsert: (typeof priceListItems.$inferInsert)[] = [];
  fresh.forEach((f) => {
    const k = fresh.indexOf(f) + 1;
    const meta = ai.items?.find((x) => x.i === k);
    const label = (meta?.shortLabel?.trim() || conciseLabel(f.description)).slice(0, 120);
    const dup = index.find(label, f.unitOfMeasure, SAME_ITEM)[0];
    if (dup) {
      used.set(dup.item.id, dup.item);
      return;
    }
    if (toInsert.some((t) => t.description.toLowerCase() === label.toLowerCase())) return;
    const category = isCatalogCategory(meta?.category)
      ? meta!.category
      : canonicalCategory(meta?.category, f.description);
    toInsert.push({
      description: label,
      unitOfMeasure: f.unitOfMeasure,
      unitPrice: String(f.unitPrice),
      category,
      subcategory: meta?.subcategory?.trim().slice(0, 40) || null,
      source: 'learned',
      lastUsedAt: new Date(),
      usageCount: 1,
      isActive: true,
      createdBy: session.user.id,
    });
  });

  if (used.size) {
    await db
      .update(priceListItems)
      .set({ lastUsedAt: sql`now()` })
      .where(inArray(priceListItems.id, [...used.keys()]));
  }
  if (toInsert.length) {
    await db.insert(priceListItems).values(toInsert);
    await renumberCodes();
  }

  return NextResponse.json({ added: toInsert.length, used: used.size });
}
