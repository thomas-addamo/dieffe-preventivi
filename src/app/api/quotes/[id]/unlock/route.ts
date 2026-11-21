import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quotes, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { notifyQuoteLockChanged, notifyUser } from "@/lib/notifications";
import { canUnlock, lockReason } from "@/lib/quote-lock";

/**
 * Sblocca il preventivo (B1).
 *  • blocco manuale dell'admin → solo admin, toglie `isLocked`;
 *  • blocco automatico → admin sempre, gli altri solo se "inviato": segna
 *    `lockOverrideAt` (vale finché non cambia lo stato). Chiude un'eventuale
 *    richiesta di sblocco e avvisa chi l'aveva fatta.
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!quote || quote.deletedAt) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  const reason = lockReason(quote);
  if (!reason) return NextResponse.json({ ok: true });
  if (!canUnlock(reason, session.user.role))
    return NextResponse.json({ error: "Solo un amministratore può sbloccare questo preventivo: puoi chiedere lo sblocco." }, { status: 403 });

  const requester = quote.unlockRequestedBy;
  const now = new Date();
  await db
    .update(quotes)
    .set(
      reason === "admin"
        ? { isLocked: false, lockedBy: null, lockedAt: null }
        : { lockOverrideAt: now, lockOverrideBy: session.user.id, unlockRequestedAt: null, unlockRequestedBy: null }
    )
    .where(eq(quotes.id, id));

  // Al titolare si dice solo ciò che non poteva fare da sé: sbloccare un
  // "inviato" è un gesto di routine e non merita una notifica.
  if (reason !== "sent") await notifyQuoteLockChanged({
    quoteId: id,
    quoteCode: quote.code,
    ownerUserId: quote.userId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    locked: false,
  });
  if (requester && requester !== session.user.id && requester !== quote.userId) {
    await notifyUser(requester, {
      type: "quote_unlocked",
      title: `Sblocco approvato · ${quote.code}`,
      body: `${session.user.name} ha sbloccato il preventivo: ora puoi modificarlo.`,
      link: `/preventivi/${id}`,
    });
  }

  await db.insert(auditLog).values({
    id: generateId(),
    userId: session.user.id,
    action: "quote.unlocked",
    entityType: "quote",
    entityId: id,
    changes: { unlockedAt: now.toISOString(), reason },
  });

  return NextResponse.json({ ok: true });
}
