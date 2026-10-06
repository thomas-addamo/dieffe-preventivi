import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { communications } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { communicationInputSchema } from "@/lib/communications";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  const [row] = await db.select().from(communications).where(eq(communications.id, id));
  if (!row) return NextResponse.json({ error: "Non trovata" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer")
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = communicationInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

  const [row] = await db
    .update(communications)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(communications.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Non trovata" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer")
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;
  await db.delete(communications).where(eq(communications.id, id));
  return NextResponse.json({ ok: true });
}
