import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { quotes, clients, users, quoteItems, quoteSections } from "@/lib/db/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { StatisticheClient } from "./StatisticheClient";

/**
 * Statistiche — visibili a TUTTI i ruoli (anche viewer), coerentemente con il
 * fatto che tutti possono già consultare l'elenco completo dei preventivi.
 */
export default async function StatistichePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const allQuotes = await db
    .select({
      id: quotes.id,
      status: quotes.status,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
      clientName: clients.name,
      authorName: users.name,
      authorId: users.id,
      discountType: quotes.discountType,
      discountValue: quotes.discountValue,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .innerJoin(users, eq(quotes.userId, users.id))
    .where(isNull(quotes.deletedAt))
    .orderBy(desc(quotes.createdAt));

  // Sezioni + voci: servono entrambe perché una sezione "a corpo" sostituisce
  // la somma delle sue voci, e le opzionali contano solo se incluse nel totale.
  const sectionRows = await db
    .select({
      id: quoteSections.id,
      quoteId: quoteSections.quoteId,
      isOptional: quoteSections.isOptional,
      isOptionalIncluded: quoteSections.isOptionalIncluded,
      lumpSum: quoteSections.lumpSum,
      lumpSumPrice: quoteSections.lumpSumPrice,
    })
    .from(quoteSections);

  const itemRows = await db
    .select({ sectionId: quoteItems.sectionId, total: quoteItems.total })
    .from(quoteItems);

  const itemsBySection = new Map<string, number>();
  for (const row of itemRows) {
    itemsBySection.set(
      row.sectionId,
      (itemsBySection.get(row.sectionId) ?? 0) + (row.total ?? 0)
    );
  }

  // Imponibile per preventivo (al netto dello sconto generale, IVA esclusa).
  const netBySection = new Map<string, number>();
  for (const s of sectionRows) {
    if (s.isOptional && !s.isOptionalIncluded) continue;
    const subtotal = s.lumpSum
      ? s.lumpSumPrice ?? 0
      : itemsBySection.get(s.id) ?? 0;
    netBySection.set(s.quoteId, (netBySection.get(s.quoteId) ?? 0) + subtotal);
  }

  const quotesWithTotals = allQuotes.map((q) => {
    const gross = netBySection.get(q.id) ?? 0;
    let discount = 0;
    if (q.discountType === "percent" && q.discountValue) {
      discount = gross * (q.discountValue / 100);
    } else if (q.discountType === "fixed" && q.discountValue) {
      discount = q.discountValue;
    }
    return { ...q, total: Math.max(0, gross - discount) };
  });

  return <StatisticheClient quotes={quotesWithTotals} />;
}
