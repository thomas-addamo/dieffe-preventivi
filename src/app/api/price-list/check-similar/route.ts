import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { db } from '@/lib/db/client';
import { priceListItems } from '@/lib/db/schema';
import { ilike, or, eq, and } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({ description: z.string().min(3) });

export async function POST(req: NextRequest) {
  const { error } = await requireRole('admin', 'editor');
  if (error) return error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ similar: [] });

  const words = parsed.data.description.toLowerCase().split(' ').filter((w) => w.length > 4);
  if (words.length === 0) return NextResponse.json({ similar: [] });

  const conditions = words.slice(0, 3).map((w) => ilike(priceListItems.description, `%${w}%`));

  const similar = await db
    .select()
    .from(priceListItems)
    .where(and(eq(priceListItems.isActive, true), or(...conditions)))
    .limit(3);

  return NextResponse.json({ similar });
}
