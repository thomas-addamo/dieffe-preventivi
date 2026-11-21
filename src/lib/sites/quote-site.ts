import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quotes, sites } from "@/lib/db/schema";
import { syncSites } from "./sync";

// Cantiere collegato a un preventivo (tasto "Vai al cantiere", sito e iPhone).
// Una lettura per chiave primaria; solo se un preventivo inviato/accettato non
// ha ancora il cantiere (l'allineamento gira in background) lo si allinea
// subito, così il tasto non resta mai vuoto.

export type QuoteSite = {
  id: string;
  name: string;
  /** pending = in attesa di accettazione · active = lavori in corso */
  status: "pending" | "active";
  archivedAt: Date | null;
  archiveReason: "completed" | "withdrawn" | null;
} | null;

const LIVE = new Set(["sent", "accepted"]);

async function readSite(quoteId: string) {
  const [row] = await db
    .select({
      status: quotes.status,
      siteId: quotes.siteId,
      site: {
        id: sites.id,
        name: sites.name,
        status: sites.status,
        archivedAt: sites.archivedAt,
        archiveReason: sites.archiveReason,
      },
    })
    .from(quotes)
    .leftJoin(sites, eq(sites.id, quotes.siteId))
    .where(and(eq(quotes.id, quoteId), isNull(quotes.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getQuoteSite(quoteId: string): Promise<{ found: boolean; site: QuoteSite }> {
  let row = await readSite(quoteId);
  if (!row) return { found: false, site: null };
  if (!row.site?.id && LIVE.has(row.status)) {
    await syncSites();
    row = (await readSite(quoteId)) ?? row;
  }
  return { found: true, site: row.site?.id ? (row.site as NonNullable<QuoteSite>) : null };
}
