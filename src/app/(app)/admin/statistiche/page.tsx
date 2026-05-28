import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { quotes, clients, users, quoteItems, quoteSections } from "@/lib/db/schema";
import { eq, desc, count, sum, and, gte, isNull } from "drizzle-orm";
import { StatisticheClient } from "./StatisticheClient";

export default async function StatistichePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const allQuotes = await db
    .select({
      id: quotes.id,
      status: quotes.status,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
      clientName: clients.name,
      authorName: users.name,
      authorId: users.id,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .innerJoin(users, eq(quotes.userId, users.id))
    .where(isNull(quotes.deletedAt))
    .orderBy(desc(quotes.createdAt));

  // Get totals per quote via sections/items
  const sections = await db
    .select({
      quoteId: quoteSections.quoteId,
      itemTotal: quoteItems.total,
    })
    .from(quoteSections)
    .innerJoin(quoteItems, eq(quoteItems.sectionId, quoteSections.id));

  const quoteTotalsMap = new Map<string, number>();
  for (const row of sections) {
    quoteTotalsMap.set(row.quoteId, (quoteTotalsMap.get(row.quoteId) ?? 0) + (row.itemTotal ?? 0));
  }

  const quotesWithTotals = allQuotes.map((q) => ({
    ...q,
    total: quoteTotalsMap.get(q.id) ?? 0,
  }));

  return <StatisticheClient quotes={quotesWithTotals} />;
}
