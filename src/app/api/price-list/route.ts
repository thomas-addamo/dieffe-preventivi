import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { priceListItems } from '@/lib/db/schema';
import { requireRole } from '@/lib/permissions/guard';
import { canonicalCategory } from '@/lib/price-list/taxonomy';
import { renumberCodes, sortCatalog } from '@/lib/price-list/maintenance';
import { ilike, eq, and, or, desc } from 'drizzle-orm';

const createSchema = z.object({
  code: z.string().optional().nullable(),
  description: z.string().min(1),
  unitOfMeasure: z.string().min(1),
  unitPrice: z.string().or(z.number()).transform(String),
  category: z.string().optional().nullable(),
  subcategory: z.string().max(40).optional().nullable(),
  pinned: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest) {
  const { error, session } = await requireRole('admin', 'editor', 'viewer');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const category = searchParams.get('category');
  const isActiveParam = searchParams.get('isActive');

  const conditions = [];
  if (q) {
    conditions.push(ilike(priceListItems.description, `%${q}%`));
  }
  if (category) {
    conditions.push(eq(priceListItems.category, category));
  }
  if (isActiveParam === 'true') {
    conditions.push(eq(priceListItems.isActive, true));
  } else if (isActiveParam === 'false') {
    conditions.push(eq(priceListItems.isActive, false));
  }

  const rows = await db
    .select()
    .from(priceListItems)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(priceListItems.code, priceListItems.description);

  return NextResponse.json(sortCatalog(rows));
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole('admin', 'editor');
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Input non valido', details: parsed.error.flatten() }, { status: 400 });

  const [item] = await db
    .insert(priceListItems)
    .values({
      ...parsed.data,
      code: null,
      category: canonicalCategory(parsed.data.category, parsed.data.description),
      subcategory: parsed.data.subcategory?.trim() || null,
      source: 'manual',
      createdBy: session!.user.id,
    })
    .returning();
  await renumberCodes();

  return NextResponse.json(item, { status: 201 });
}
