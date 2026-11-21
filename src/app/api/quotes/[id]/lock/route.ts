import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quotes, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { notifyQuoteLockChanged } from "@/lib/notifications";
import { lockReason } from "@/lib/quote-lock";

/**
 * Blocca il preventivo (B1).
 *  • se era stato sbloccato un blocco automatico → torna bloccato (lo può fare
 *    chiunque possa modificarlo: "Riblocca");
 *  • altrimenti blocco manuale → solo admin.
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!quote || quote.deletedAt) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  const relock = !!quote.lockOverrideAt && !!lockReason({ ...quote, lockOverrideAt: null });
  if (!relock && session.user.role !== "admin")
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  await db
    .update(quotes)
    .set(relock ? { lockOverrideAt: null, lockOverrideBy: null } : { isLocked: true, lockedBy: session.user.id, lockedAt: new Date() })
    .where(eq(quotes.id, id));

  // "Riblocca" rimette il blocco automatico: nessuna notifica (solo il blocco
  // manuale dell'admin si comunica al titolare).
  if (!relock) await notifyQuoteLockChanged({
    quoteId: id,
    quoteCode: quote.code,
    ownerUserId: quote.userId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    locked: true,
  });

  await db.insert(auditLog).values({
    id: generateId(),
    userId: session.user.id,
    action: "quote.locked",
    entityType: "quote",
    entityId: id,
    changes: { lockedAt: new Date().toISOString(), relock },
  });

  return NextResponse.json({ ok: true });
}
