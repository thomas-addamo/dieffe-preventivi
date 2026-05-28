import { db } from "@/lib/db/client";
import {
  quotes,
  quoteSections,
  quoteItems,
  quoteItemImages,
  quoteYearCounters,
  quoteSignatures,
  companySettings,
  clients,
  users,
} from "@/lib/db/schema";
import { eq, asc, inArray, and, isNull } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { calcItemTotal } from "@/lib/calculations";
import type { QuoteWithRelations } from "@/types";

export async function generateQuoteCode(): Promise<string> {
  const year = new Date().getFullYear();

  const [settings] = await db.select({ quotePrefix: companySettings.quotePrefix }).from(companySettings).limit(1);
  const prefix = settings?.quotePrefix ?? "PREV";

  const [existing] = await db
    .select()
    .from(quoteYearCounters)
    .where(eq(quoteYearCounters.year, year))
    .limit(1);

  if (!existing) {
    await db.insert(quoteYearCounters).values({ year, counter: 1 });
    return `${prefix}-${year}-001`;
  } else {
    const next = existing.counter + 1;
    await db
      .update(quoteYearCounters)
      .set({ counter: next })
      .where(eq(quoteYearCounters.year, year));
    return `${prefix}-${year}-${String(next).padStart(3, "0")}`;
  }
}

export async function getQuoteWithRelations(
  id: string
): Promise<QuoteWithRelations | null> {
  const [quote] = await db
    .select()
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .innerJoin(users, eq(quotes.userId, users.id))
    .where(and(eq(quotes.id, id), isNull(quotes.deletedAt)))
    .limit(1);

  if (!quote) return null;

  const sections = await db
    .select()
    .from(quoteSections)
    .where(eq(quoteSections.quoteId, id))
    .orderBy(asc(quoteSections.orderIndex));

  const items =
    sections.length > 0
      ? await db
          .select()
          .from(quoteItems)
          .where(
            inArray(
              quoteItems.sectionId,
              sections.map((s) => s.id)
            )
          )
          .orderBy(asc(quoteItems.orderIndex))
      : [];

  const images =
    items.length > 0
      ? await db
          .select()
          .from(quoteItemImages)
          .where(
            inArray(
              quoteItemImages.itemId,
              items.map((i) => i.id)
            )
          )
          .orderBy(asc(quoteItemImages.orderIndex))
      : [];

  const itemMap = new Map(
    items.map((item) => [
      item.id,
      {
        ...item,
        images: images.filter((img) => img.itemId === item.id),
      },
    ])
  );

  const sectionsWithItems = sections.map((section) => ({
    ...section,
    items: items
      .filter((i) => i.sectionId === section.id)
      .map((i) => itemMap.get(i.id)!),
  }));

  const [sig] = await db
    .select()
    .from(quoteSignatures)
    .where(eq(quoteSignatures.quoteId, id))
    .orderBy(asc(quoteSignatures.signedAt))
    .limit(1);

  return {
    ...quote.quotes,
    client: quote.clients ?? null,
    author: {
      id: quote.users.id,
      name: quote.users.name,
      email: quote.users.email,
    },
    sections: sectionsWithItems,
    signature: sig ?? null,
  };
}

export async function createQuote(
  userId: string,
  data: {
    title: string;
    clientId?: string | null;
    projectAddress?: string | null;
    vatRate?: number;
    notes?: string | null;
    paymentTerms?: string | null;
    validUntil?: string | null;
  }
) {
  const code = await generateQuoteCode();
  const id = generateId();
  await db.insert(quotes).values({
    id,
    code,
    title: data.title,
    clientId: data.clientId ?? null,
    userId,
    vatRate: data.vatRate ?? 22,
    notes: data.notes ?? null,
    paymentTerms: data.paymentTerms ?? null,
    validUntil: data.validUntil ?? null,
    projectAddress: data.projectAddress ?? null,
  });
  return id;
}

export async function updateQuoteField(
  quoteId: string,
  field: Partial<typeof quotes.$inferInsert>
) {
  await db
    .update(quotes)
    .set({ ...field, updatedAt: new Date().toISOString() })
    .where(eq(quotes.id, quoteId));
}

export async function upsertSection(
  quoteId: string,
  data: {
    id?: string;
    code: string;
    title: string;
    description?: string | null;
    orderIndex: number;
    sectionNote?: string | null;
    isOptional?: boolean;
    isOptionalIncluded?: boolean;
  }
) {
  const id = data.id ?? generateId();

  const [existing] = data.id
    ? await db
        .select()
        .from(quoteSections)
        .where(eq(quoteSections.id, data.id))
        .limit(1)
    : [];

  if (existing) {
    await db
      .update(quoteSections)
      .set({
        code: data.code,
        title: data.title,
        description: data.description ?? null,
        orderIndex: data.orderIndex,
        sectionNote: data.sectionNote ?? null,
        isOptional: data.isOptional ?? false,
        isOptionalIncluded: data.isOptionalIncluded ?? false,
      })
      .where(eq(quoteSections.id, id));
  } else {
    await db.insert(quoteSections).values({
      id,
      quoteId,
      code: data.code,
      title: data.title,
      description: data.description ?? null,
      orderIndex: data.orderIndex,
      sectionNote: data.sectionNote ?? null,
      isOptional: data.isOptional ?? false,
      isOptionalIncluded: data.isOptionalIncluded ?? false,
    });
  }
  return id;
}

export async function upsertItem(
  sectionId: string,
  data: {
    id?: string;
    description: string;
    unitOfMeasure: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    notes?: string | null;
    orderIndex: number;
  }
) {
  const id = data.id ?? generateId();
  const total = calcItemTotal(data.quantity, data.unitPrice, data.discount);

  const [existing] = data.id
    ? await db
        .select()
        .from(quoteItems)
        .where(eq(quoteItems.id, data.id))
        .limit(1)
    : [];

  if (existing) {
    await db
      .update(quoteItems)
      .set({
        description: data.description,
        unitOfMeasure: data.unitOfMeasure,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        discount: data.discount,
        total,
        notes: data.notes ?? null,
        orderIndex: data.orderIndex,
      })
      .where(eq(quoteItems.id, id));
  } else {
    await db.insert(quoteItems).values({
      id,
      sectionId,
      description: data.description,
      unitOfMeasure: data.unitOfMeasure,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      discount: data.discount,
      total,
      notes: data.notes ?? null,
      orderIndex: data.orderIndex,
    });
  }
  return id;
}
