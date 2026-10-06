import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { clients, quotes } from "@/lib/db/schema";
import { getQuoteNetTotals } from "@/lib/db/quote-totals";
import { desc, isNull } from "drizzle-orm";
import { ClientiClient, type ClientQuote } from "./ClientiClient";

export default async function ClientiPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const rows = await db.select().from(clients).orderBy(desc(clients.createdAt));

  // Preventivi collegati a ciascun cliente (cestino escluso).
  const quoteRows = await db
    .select({
      id: quotes.id,
      code: quotes.code,
      title: quotes.title,
      status: quotes.status,
      clientId: quotes.clientId,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .where(isNull(quotes.deletedAt))
    .orderBy(desc(quotes.createdAt));

  const totals = await getQuoteNetTotals();

  const quotesByClient = new Map<string, ClientQuote[]>();
  for (const q of quoteRows) {
    if (!q.clientId) continue;
    const list = quotesByClient.get(q.clientId) ?? [];
    list.push({
      id: q.id,
      code: q.code,
      title: q.title,
      status: q.status,
      createdAt: q.createdAt,
      total: totals.get(q.id) ?? 0,
    });
    quotesByClient.set(q.clientId, list);
  }

  const clientsWithQuotes = rows.map((c) => ({
    ...c,
    quotes: quotesByClient.get(c.id) ?? [],
  }));

  return <ClientiClient initialClients={clientsWithQuotes} />;
}
