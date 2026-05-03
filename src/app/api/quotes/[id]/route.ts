import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getQuoteWithRelations, updateQuoteField } from "@/lib/db/quotes";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  clientId: z.string().nullable().optional(),
  projectAddress: z.string().nullable().optional(),
  vatRate: z.number().optional(),
  discountType: z.enum(["percent", "fixed"]).nullable().optional(),
  discountValue: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  const quote = await getQuoteWithRelations(id);
  if (!quote) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  return NextResponse.json(quote);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  await updateQuoteField(id, parsed.data as Parameters<typeof updateQuoteField>[1]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  await db.delete(quotes).where(eq(quotes.id, id));
  return NextResponse.json({ ok: true });
}
