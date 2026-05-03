import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quoteSections, quoteItems, quoteItemImages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { upsertSection } from "@/lib/db/quotes";

const sectionSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  orderIndex: z.number().int(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id: quoteId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = sectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const sectionId = await upsertSection(quoteId, parsed.data);
  return NextResponse.json({ id: sectionId }, { status: 201 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id: quoteId } = await params;
  const body = await req.json().catch(() => ({}));

  // bulk replace all sections
  const sectionsSchema = z.array(sectionSchema);
  const parsed = sectionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  for (const s of parsed.data) {
    await upsertSection(quoteId, s);
  }
  return NextResponse.json({ ok: true });
}
