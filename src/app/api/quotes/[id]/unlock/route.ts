import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quotes, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { notifyQuoteLockChanged } from "@/lib/notifications";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;
  const [quote] = await db
    .select({ code: quotes.code, userId: quotes.userId })
    .from(quotes)
    .where(eq(quotes.id, id))
    .limit(1);
  if (!quote) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  await db.update(quotes)
    .set({ isLocked: false, lockedBy: null, lockedAt: null })
    .where(eq(quotes.id, id));

  await notifyQuoteLockChanged({
    quoteId: id,
    quoteCode: quote.code,
    ownerUserId: quote.userId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    locked: false,
  });

  await db.insert(auditLog).values({
    id: generateId(),
    userId: session.user.id,
    action: "quote.unlocked",
    entityType: "quote",
    entityId: id,
    changes: { unlockedAt: new Date().toISOString() },
  });

  return NextResponse.json({ ok: true });
}
