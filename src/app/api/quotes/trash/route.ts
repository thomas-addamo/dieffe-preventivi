import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quotes, clients, users } from "@/lib/db/schema";
import { eq, isNotNull, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const rows = await db
    .select({
      id: quotes.id,
      code: quotes.code,
      title: quotes.title,
      status: quotes.status,
      deletedAt: quotes.deletedAt,
      clientName: clients.name,
      authorName: users.name,
      deletedByName: users.name,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .innerJoin(users, eq(quotes.userId, users.id))
    .where(isNotNull(quotes.deletedAt))
    .orderBy(desc(quotes.deletedAt));

  // Calculate days remaining (30 - days since deletion)
  const now = Date.now();
  const result = rows.map((row) => {
    const deletedMs = row.deletedAt ? new Date(row.deletedAt).getTime() : now;
    const daysElapsed = Math.floor((now - deletedMs) / (1000 * 60 * 60 * 24));
    return {
      ...row,
      daysRemaining: Math.max(0, 30 - daysElapsed),
    };
  });

  return NextResponse.json(result);
}
