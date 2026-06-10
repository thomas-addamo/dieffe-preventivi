import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { upsertItem, checkQuoteEditable } from "@/lib/db/quotes";
import { db } from "@/lib/db/client";
import { quoteSections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

const itemSchema = z.object({
  id: z.string().optional(),
  sectionId: z.string(),
  description: z.string(),
  unitOfMeasure: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  discount: z.number().default(0),
  notes: z.string().nullable().optional(),
  orderIndex: z.number().int(),
});

async function quoteSectionIds(quoteId: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: quoteSections.id })
    .from(quoteSections)
    .where(eq(quoteSections.quoteId, quoteId));
  return new Set(rows.map((r) => r.id));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id: quoteId } = await params;
  const guard = await checkQuoteEditable(quoteId, session.user.role);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => ({}));
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const { sectionId, ...data } = parsed.data;
  const validSections = await quoteSectionIds(quoteId);
  if (!validSections.has(sectionId)) {
    return NextResponse.json({ error: "Sezione non appartenente al preventivo" }, { status: 400 });
  }

  const itemId = await upsertItem(sectionId, data);
  logger.info({ itemId, sectionId }, "item upserted");
  return NextResponse.json({ id: itemId }, { status: 201 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id: quoteId } = await params;
  const guard = await checkQuoteEditable(quoteId, session.user.role);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => ({}));
  const itemsSchema = z.array(itemSchema).max(500);
  const parsed = itemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const validSections = await quoteSectionIds(quoteId);
  for (const item of parsed.data) {
    const { sectionId, ...data } = item;
    if (!validSections.has(sectionId)) continue;
    await upsertItem(sectionId, data);
  }
  return NextResponse.json({ ok: true });
}
