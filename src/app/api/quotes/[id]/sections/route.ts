import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { upsertSection } from "@/lib/db/quotes";
import { logger } from "@/lib/logger";

const sectionSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  orderIndex: z.number().int(),
  sectionNote: z.string().nullable().optional(),
  isOptional: z.boolean().optional(),
  isOptionalIncluded: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id: quoteId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = sectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const sectionId = await upsertSection(quoteId, parsed.data);
  logger.info({ sectionId, quoteId }, "section upserted");
  return NextResponse.json({ id: sectionId }, { status: 201 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

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
