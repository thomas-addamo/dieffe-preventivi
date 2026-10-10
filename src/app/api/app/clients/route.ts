import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { clients, quotes } from "@/lib/db/schema";
import { desc, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getQuoteNetTotals } from "@/lib/db/quote-totals";

/**
 * Clienti con i loro preventivi (cestino escluso) per l'app iPhone: gli stessi
 * dati della pagina web src/app/(app)/clienti/page.tsx.
 */
export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const [rows, quoteRows, totals] = await Promise.all([
    db.select().from(clients).orderBy(desc(clients.createdAt)),
    db
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
      .orderBy(desc(quotes.createdAt)),
    getQuoteNetTotals(),
  ]);

  const byClient = new Map<string, { id: string; code: string; title: string; status: string; createdAt: string; total: number }[]>();
  for (const { clientId, ...q } of quoteRows) {
    if (!clientId) continue;
    byClient.set(clientId, [...(byClient.get(clientId) ?? []), { ...q, total: totals.get(q.id) ?? 0 }]);
  }

  return NextResponse.json(rows.map((c) => ({ ...c, quotes: byClient.get(c.id) ?? [] })));
}
