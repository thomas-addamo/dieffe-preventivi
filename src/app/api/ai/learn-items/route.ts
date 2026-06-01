import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { db } from '@/lib/db/client';
import { priceListItems } from '@/lib/db/schema';
import { ilike, eq, and } from 'drizzle-orm';
import { z } from 'zod';

const itemSchema = z.object({
  description: z.string(),
  unitOfMeasure: z.string(),
  unitPrice: z.number(),
});

const schema = z.object({
  items: z.array(itemSchema),
});

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole('admin', 'editor');
  if (error) return error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ added: 0 });

  const candidates = parsed.data.items.filter(
    (i) => i.description.trim().length >= 15 && i.unitPrice > 0
  );

  let added = 0;
  for (const item of candidates) {
    const existing = await db
      .select({ id: priceListItems.id })
      .from(priceListItems)
      .where(
        and(
          eq(priceListItems.isActive, true),
          ilike(priceListItems.description, item.description.trim())
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(priceListItems).values({
        description: item.description.trim(),
        unitOfMeasure: item.unitOfMeasure,
        unitPrice: String(item.unitPrice),
        category: 'Auto',
        notes: 'Appreso automaticamente da preventivo',
        isActive: true,
        createdBy: session.user.id,
      });
      added++;
    }
  }

  return NextResponse.json({ added });
}
