import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quotes, clients, users } from "@/lib/db/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getQuoteNetTotals } from "@/lib/db/quote-totals";
import { startOfMonth, endOfMonth, format } from "date-fns";

/**
 * Dati della Home dell'app iPhone (ios/, schermata nativa): gli stessi della
 * dashboard web (src/app/(app)/dashboard/page.tsx) in un'unica risposta JSON.
 */
export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd") + "T23:59:59";

  const [rows, totals, clientRows] = await Promise.all([
    db
      .select({
        id: quotes.id,
        code: quotes.code,
        title: quotes.title,
        status: quotes.status,
        createdAt: quotes.createdAt,
        updatedAt: quotes.updatedAt,
        clientId: quotes.clientId,
        clientName: clients.name,
        authorName: users.name,
        publicToken: quotes.publicToken,
        publicTokenExpiresAt: quotes.publicTokenExpiresAt,
        kind: quotes.kind,
        parentQuoteId: quotes.parentQuoteId,
      })
      .from(quotes)
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .innerJoin(users, eq(quotes.userId, users.id))
      .where(isNull(quotes.deletedAt))
      .orderBy(desc(quotes.createdAt)),
    getQuoteNetTotals(),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(clients.name),
  ]);

  const quoteList = rows.map(({ publicToken, publicTokenExpiresAt, ...q }) => ({
    ...q,
    total: totals.get(q.id) ?? 0,
    publicLinkActive:
      !!publicToken && !!publicTokenExpiresAt && now < new Date(publicTokenExpiresAt),
  }));

  return NextResponse.json({
    user: { id: session.user.id, name: session.user.name, role: session.user.role },
    stats: {
      total: rows.length,
      acceptedThisMonth: rows.filter(
        (q) => q.status === "accepted" && q.updatedAt >= monthStart && q.updatedAt <= monthEnd
      ).length,
      pending: rows.filter((q) => q.status === "sent").length,
      clients: clientRows.length,
    },
    quotes: quoteList,
    clients: clientRows,
  });
}
