import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { eq, and, isNull, desc, count } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

// GET /api/notifications?unread=1&limit=20 — notifiche dell'utente corrente
export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const onlyUnread = searchParams.get("unread") === "1";
  const limit = Math.min(Number(searchParams.get("limit")) || 30, 100);

  const conditions = [eq(notifications.userId, session.user.id)];
  if (onlyUnread) conditions.push(isNull(notifications.readAt));

  const [rows, [unread]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt))),
  ]);

  return NextResponse.json({
    notifications: rows,
    unreadCount: unread?.value ?? 0,
  });
}

// PATCH /api/notifications — segna tutte come lette
export async function PATCH() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt)));

  return NextResponse.json({ ok: true });
}

// DELETE /api/notifications — elimina tutte le notifiche già lette
export async function DELETE() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  await db
    .delete(notifications)
    .where(and(eq(notifications.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
