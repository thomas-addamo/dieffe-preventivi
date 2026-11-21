import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { quotes, clients, users } from "@/lib/db/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { getQuoteNetTotals } from "@/lib/db/quote-totals";
import { PreventiviClient } from "./PreventiviClient";

// Elenco dei preventivi (C1): ricerca, filtri, aperti di recente. Sta solo
// qui: la dashboard mostra il riepilogo del momento, non l'archivio.
export default async function PreventiviPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const [allQuotes, totals, allClients] = await Promise.all([
    db
      .select({
        id: quotes.id,
        code: quotes.code,
        title: quotes.title,
        status: quotes.status,
        vatRate: quotes.vatRate,
        createdAt: quotes.createdAt,
        updatedAt: quotes.updatedAt,
        clientName: clients.name,
        authorName: users.name,
        publicToken: quotes.publicToken,
        publicTokenExpiresAt: quotes.publicTokenExpiresAt,
        kind: quotes.kind,
        parentQuoteId: quotes.parentQuoteId,
        validUntil: quotes.validUntil,
        sentAt: quotes.sentAt,
      })
      .from(quotes)
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .innerJoin(users, eq(quotes.userId, users.id))
      .where(isNull(quotes.deletedAt))
      .orderBy(desc(quotes.createdAt)),
    getQuoteNetTotals(),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(clients.name),
  ]);

  return (
    <PreventiviClient
      initialQuotes={allQuotes.map((q) => ({ ...q, total: totals.get(q.id) ?? 0 }))}
      clients={allClients}
    />
  );
}
