import { redirect } from "next/navigation";
import { desc, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { clients, quotes } from "@/lib/db/schema";
import { getQuoteNetTotals } from "@/lib/db/quote-totals";
import { LavoriExtraClient, type ExtraQuote } from "./LavoriExtraClient";

export default async function LavoriExtraPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: quotes.id,
        code: quotes.code,
        title: quotes.title,
        status: quotes.status,
        kind: quotes.kind,
        parentQuoteId: quotes.parentQuoteId,
        createdAt: quotes.createdAt,
        clientName: clients.name,
      })
      .from(quotes)
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(isNull(quotes.deletedAt))
      .orderBy(desc(quotes.createdAt)),
    getQuoteNetTotals(),
  ]);

  const list: ExtraQuote[] = rows.map((r) => ({ ...r, total: totals.get(r.id) ?? 0 }));
  return <LavoriExtraClient quotes={list} />;
}
