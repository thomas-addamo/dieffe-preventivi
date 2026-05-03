import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { upsertItem } from "@/lib/db/quotes";

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

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const { sectionId, ...data } = parsed.data;
  const itemId = await upsertItem(sectionId, data);
  return NextResponse.json({ id: itemId }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const itemsSchema = z.array(itemSchema);
  const parsed = itemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  for (const item of parsed.data) {
    const { sectionId, ...data } = item;
    await upsertItem(sectionId, data);
  }
  return NextResponse.json({ ok: true });
}
