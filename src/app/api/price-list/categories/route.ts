import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { priceListItems } from '@/lib/db/schema';
import { requireRole } from '@/lib/permissions/guard';
import { isNotNull, sql } from 'drizzle-orm';

export async function GET() {
  const { error } = await requireRole('admin', 'editor', 'viewer');
  if (error) return error;

  const rows = await db
    .selectDistinct({ category: priceListItems.category })
    .from(priceListItems)
    .where(isNotNull(priceListItems.category))
    .orderBy(priceListItems.category);

  return NextResponse.json(rows.map((r) => r.category).filter(Boolean));
}
