import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quotes, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { notifyQuoteAssigned } from "@/lib/notifications";

const schema = z.object({ userId: z.string() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

  const [prev] = await db
    .select({ userId: quotes.userId, code: quotes.code, title: quotes.title })
    .from(quotes)
    .where(eq(quotes.id, id))
    .limit(1);
  if (!prev) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  await db.update(quotes).set({ userId: parsed.data.userId }).where(eq(quotes.id, id));

  await notifyQuoteAssigned({
    quoteId: id,
    quoteCode: prev.code,
    quoteTitle: prev.title,
    newOwnerUserId: parsed.data.userId,
    actorUserId: session.user.id,
    actorName: session.user.name,
  });

  await db.insert(auditLog).values({
    id: generateId(),
    userId: session.user.id,
    action: "quote.reassigned",
    entityType: "quote",
    entityId: id,
    changes: { fromUserId: prev.userId, toUserId: parsed.data.userId },
  });

  return NextResponse.json({ ok: true });
}
