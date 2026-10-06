import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { CATALOG } from '@/lib/price-list/taxonomy';

/** Categorie del catalogo (fisse, nell'ordine del computo metrico). */
export async function GET() {
  const { error } = await requireRole('admin', 'editor', 'viewer');
  if (error) return error;
  return NextResponse.json(CATALOG.map((c) => c.name));
}
