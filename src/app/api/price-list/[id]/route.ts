import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { priceListItems } from '@/lib/db/schema';
import { requireRole } from '@/lib/permissions/guard';
import { eq } from 'drizzle-orm';

const updateSchema = z.object({
  code: z.string().optional().nullable(),
  description: z.string().min(1).optional(),
  unitOfMeasure: z.string().min(1).optional(),
  unitPrice: z.string().or(z.number()).transform(String).optional(),
  category: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole('admin', 'editor');
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Input non valido' }, { status: 400 });

  const [item] = await db
    .update(priceListItems)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(priceListItems.id, id))
    .returning();

  if (!item) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole('admin');
  if (error) return error;

  const { id } = await params;
  const [deleted] = await db
    .delete(priceListItems)
    .where(eq(priceListItems.id, id))
    .returning();

  if (!deleted) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
