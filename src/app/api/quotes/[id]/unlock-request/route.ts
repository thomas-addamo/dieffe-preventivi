import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quotes, auditLog } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { notifyAdmins, notifyUser } from "@/lib/notifications";
import { canRequestUnlock, lockReason, LOCK_TEXT } from "@/lib/quote-lock";

// Richiesta di sblocco (B1): chi non può sbloccare da sé la manda agli admin
// (campanella + push); l'admin la approva sbloccando (PATCH /unlock) o la
// rifiuta (DELETE qui). Una sola richiesta aperta per preventivo.

async function load(id: string) {
  const [q] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  return q && !q.deletedAt ? q : null;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await params;
  const quote = await load(id);
  if (!quote) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  const reason = lockReason(quote);
  if (!canRequestUnlock(reason, session.user.role))
    return NextResponse.json({ error: "Non serve chiedere lo sblocco per questo preventivo" }, { status: 400 });
  if (quote.unlockRequestedAt) return NextResponse.json({ ok: true, already: true });

  const now = new Date();
  await db.update(quotes).set({ unlockRequestedAt: now, unlockRequestedBy: session.user.id }).where(eq(quotes.id, id));
  await notifyAdmins(
    {
      type: "quote_locked",
      title: `Richiesta di sblocco · ${quote.code}`,
      body: `${session.user.name} chiede di sbloccare "${quote.title}" (${LOCK_TEXT[reason!].title.toLowerCase()}).`,
      link: `/preventivi/${id}`,
    },
    session.user.id
  );
  await db.insert(auditLog).values({
    id: generateId(),
    userId: session.user.id,
    action: "quote.unlock_requested",
    entityType: "quote",
    entityId: id,
    changes: { reason },
  });
  return NextResponse.json({ ok: true, requestedAt: now.toISOString() });
}

/** L'admin rifiuta la richiesta (o chi l'ha fatta la ritira). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await params;
  const quote = await load(id);
  if (!quote) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  if (!quote.unlockRequestedAt) return NextResponse.json({ ok: true });

  const isAdmin = session.user.role === "admin";
  if (!isAdmin && quote.unlockRequestedBy !== session.user.id)
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const requester = quote.unlockRequestedBy;
  await db.update(quotes).set({ unlockRequestedAt: null, unlockRequestedBy: null }).where(eq(quotes.id, id));
  if (isAdmin && requester && requester !== session.user.id) {
    await notifyUser(requester, {
      type: "quote_locked",
      title: `Sblocco non concesso · ${quote.code}`,
      body: `${session.user.name} ha lasciato bloccato il preventivo.`,
      link: `/preventivi/${id}`,
    });
  }
  await db.insert(auditLog).values({
    id: generateId(),
    userId: session.user.id,
    action: isAdmin ? "quote.unlock_rejected" : "quote.unlock_withdrawn",
    entityType: "quote",
    entityId: id,
    changes: {},
  });
  return NextResponse.json({ ok: true });
}
