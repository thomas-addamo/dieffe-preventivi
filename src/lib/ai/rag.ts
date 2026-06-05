import { db } from '../db/client';
import { quotes, quoteSections, quoteItems, clients, priceListItems } from '../db/schema';
import { ilike, or, eq, isNull, desc, and } from 'drizzle-orm';

export type QuoteItemResult = {
  description: string;
  unitOfMeasure: string;
  unitPrice: number;
  quantity: number;
  total: number;
  quoteCode: string;
  quoteTitle: string;
  clientName: string | null;
  quoteDate: string | null;
  quoteStatus: string | null;
};

export type PriceListResult = {
  description: string;
  unitOfMeasure: string;
  unitPrice: string;
  category: string | null;
};

export async function searchAll(query: string): Promise<{
  quoteItems: QuoteItemResult[];
  listinoItems: PriceListResult[];
}> {
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  if (keywords.length === 0) return { quoteItems: [], listinoItems: [] };

  const itemConditions = keywords.map((k) => ilike(quoteItems.description, `%${k}%`));
  const listConditions = keywords.map((k) => ilike(priceListItems.description, `%${k}%`));

  const [items, listino] = await Promise.all([
    db
      .select({
        description: quoteItems.description,
        unitOfMeasure: quoteItems.unitOfMeasure,
        unitPrice: quoteItems.unitPrice,
        quantity: quoteItems.quantity,
        total: quoteItems.total,
        quoteCode: quotes.code,
        quoteTitle: quotes.title,
        clientName: clients.name,
        quoteDate: quotes.createdAt,
        quoteStatus: quotes.status,
      })
      .from(quoteItems)
      .innerJoin(quoteSections, eq(quoteItems.sectionId, quoteSections.id))
      .innerJoin(quotes, eq(quoteSections.quoteId, quotes.id))
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(and(isNull(quotes.deletedAt), or(...itemConditions)))
      .orderBy(desc(quotes.createdAt))
      .limit(20),

    db
      .select({
        description: priceListItems.description,
        unitOfMeasure: priceListItems.unitOfMeasure,
        unitPrice: priceListItems.unitPrice,
        category: priceListItems.category,
      })
      .from(priceListItems)
      .where(and(eq(priceListItems.isActive, true), or(...listConditions)))
      .limit(10),
  ]);

  return { quoteItems: items as QuoteItemResult[], listinoItems: listino };
}

// ─── Price intelligence (per il suggerimento prezzo) ──────────────────────────

export interface PriceIntel {
  listino: { description: string; unitOfMeasure: string; unitPrice: number; category: string | null; code: string | null }[];
  history: { description: string; unitOfMeasure: string; unitPrice: number; quoteCode: string; clientName: string | null; date: string | null }[];
  stats: { count: number; min: number; max: number; avg: number; lastPrice: number | null; lastDate: string | null } | null;
}

/**
 * Raccoglie l'intelligenza prezzo per una descrizione: voci di listino simili
 * + storico reale dei preventivi (con statistiche min/max/media/ultimo).
 * È la base per un suggerimento "spiegabile".
 */
export async function buildPriceIntel(description: string): Promise<PriceIntel> {
  const keywords = description
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  if (keywords.length === 0) return { listino: [], history: [], stats: null };

  const itemConditions = keywords.map((k) => ilike(quoteItems.description, `%${k}%`));
  const listConditions = keywords.map((k) => ilike(priceListItems.description, `%${k}%`));

  const [listino, history] = await Promise.all([
    db
      .select({
        description: priceListItems.description,
        unitOfMeasure: priceListItems.unitOfMeasure,
        unitPrice: priceListItems.unitPrice,
        category: priceListItems.category,
        code: priceListItems.code,
      })
      .from(priceListItems)
      .where(and(eq(priceListItems.isActive, true), or(...listConditions)))
      .limit(8),

    db
      .select({
        description: quoteItems.description,
        unitOfMeasure: quoteItems.unitOfMeasure,
        unitPrice: quoteItems.unitPrice,
        quoteCode: quotes.code,
        clientName: clients.name,
        date: quotes.createdAt,
      })
      .from(quoteItems)
      .innerJoin(quoteSections, eq(quoteItems.sectionId, quoteSections.id))
      .innerJoin(quotes, eq(quoteSections.quoteId, quotes.id))
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(and(isNull(quotes.deletedAt), or(...itemConditions)))
      .orderBy(desc(quotes.createdAt))
      .limit(15),
  ]);

  const prices = history.map((h) => h.unitPrice).filter((p) => p > 0);
  const stats =
    prices.length > 0
      ? {
          count: prices.length,
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
          lastPrice: history[0]?.unitPrice ?? null,
          lastDate: history[0]?.date?.substring(0, 10) ?? null,
        }
      : null;

  return {
    listino: listino.map((l) => ({ ...l, unitPrice: parseFloat(l.unitPrice) })),
    history: history.map((h) => ({ ...h, date: h.date?.substring(0, 10) ?? null })),
    stats,
  };
}

export async function buildSearchContext(query: string): Promise<string> {
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  if (keywords.length === 0) return '';

  const itemConditions = keywords.map((k) => ilike(quoteItems.description, `%${k}%`));
  const listConditions = keywords.map((k) => ilike(priceListItems.description, `%${k}%`));

  const [items, listino] = await Promise.all([
    db
      .select({
        description: quoteItems.description,
        unitOfMeasure: quoteItems.unitOfMeasure,
        unitPrice: quoteItems.unitPrice,
        quantity: quoteItems.quantity,
        total: quoteItems.total,
        quoteCode: quotes.code,
        quoteTitle: quotes.title,
        clientName: clients.name,
        quoteDate: quotes.createdAt,
        quoteStatus: quotes.status,
      })
      .from(quoteItems)
      .innerJoin(quoteSections, eq(quoteItems.sectionId, quoteSections.id))
      .innerJoin(quotes, eq(quoteSections.quoteId, quotes.id))
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(and(isNull(quotes.deletedAt), or(...itemConditions)))
      .orderBy(desc(quotes.createdAt))
      .limit(20),

    db
      .select({
        description: priceListItems.description,
        unitOfMeasure: priceListItems.unitOfMeasure,
        unitPrice: priceListItems.unitPrice,
        category: priceListItems.category,
      })
      .from(priceListItems)
      .where(and(eq(priceListItems.isActive, true), or(...listConditions)))
      .limit(10),
  ]);

  let context = '';

  if (items.length > 0) {
    context += `\n=== PREVENTIVI AZIENDALI (dati reali) ===\n`;
    items.forEach((item) => {
      const date = item.quoteDate?.substring(0, 10) ?? 'N/D';
      const status: Record<string, string> = {
        draft: 'bozza', sent: 'inviato', accepted: 'accettato',
        rejected: 'rifiutato', archived: 'archiviato',
      };
      context +=
        `- "${item.description}" | ${item.unitOfMeasure} | €${item.unitPrice}/u.m. | ` +
        `qtà: ${item.quantity} | totale riga: €${item.total?.toFixed(2)} | ` +
        `Preventivo ${item.quoteCode} "${item.quoteTitle}" | ` +
        `Cliente: ${item.clientName ?? 'N/D'} | Data: ${date} | ` +
        `Stato: ${status[item.quoteStatus ?? ''] ?? item.quoteStatus}\n`;
    });
  }

  if (listino.length > 0) {
    context += `\n=== LISTINO PREZZI AZIENDALE ===\n`;
    listino.forEach((item) => {
      context +=
        `- "${item.description}" | ${item.unitOfMeasure} | ` +
        `€${item.unitPrice} | Categoria: ${item.category ?? 'N/D'}\n`;
    });
  }

  return context;
}
