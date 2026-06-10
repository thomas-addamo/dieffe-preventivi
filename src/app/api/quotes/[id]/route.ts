import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quotes, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getQuoteWithRelations, updateQuoteField, checkQuoteEditable } from "@/lib/db/quotes";
import { generateId } from "@/lib/utils";
import { notifyQuoteDeleted } from "@/lib/notifications";

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
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;
  const guard = await checkQuoteEditable(id, session.user.role);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

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
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;
  const guard = await checkQuoteEditable(id, session.user.role);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  // Soft delete: sposta nel cestino
  await db.update(quotes)
    .set({ deletedAt: new Date(), deletedBy: session.user.id })
    .where(eq(quotes.id, id));

  await db.insert(auditLog).values({
    id: generateId(),
    userId: session.user.id,
    action: "quote.deleted",
    entityType: "quote",
    entityId: id,
    changes: { deletedAt: new Date().toISOString() },
  });

  await notifyQuoteDeleted({
    quoteCode: guard.quote.code,
    quoteTitle: guard.quote.title,
    ownerUserId: guard.quote.userId,
    actorUserId: session.user.id,
    actorName: session.user.name,
  });

  return NextResponse.json({ ok: true });
}
