import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { clients, quotes, sites } from "@/lib/db/schema";
import { sitesEnabledFor } from "@/lib/features";

// Ricerca globale della barra in alto (C2, ⌘K): preventivi, clienti e
// cantieri, al massimo 5 per gruppo. Tabelle piccole: basta ilike.

export type SearchResult = {
  quotes: { id: string; code: string; title: string; status: string; clientName: string | null }[];
  clients: { id: string; name: string; address: string | null }[];
  sites: { id: string; name: string; address: string | null; archived: boolean }[];
};

const LIMIT = 5;

export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ quotes: [], clients: [], sites: [] } satisfies SearchResult);
  // % e _ sono jolly di LIKE: vanno cercati come caratteri normali.
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const showSites = sitesEnabledFor(session.user.role);

  const [quoteRows, clientRows, siteRows] = await Promise.all([
    db.select({ id: quotes.id, code: quotes.code, title: quotes.title, status: quotes.status, clientName: clients.name })
      .from(quotes).leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(and(isNull(quotes.deletedAt), or(ilike(quotes.code, like), ilike(quotes.title, like), ilike(clients.name, like), ilike(quotes.projectAddress, like))))
      .orderBy(desc(quotes.updatedAt)).limit(LIMIT),
    db.select({ id: clients.id, name: clients.name, address: clients.address }).from(clients)
      .where(or(ilike(clients.name, like), ilike(clients.email, like), ilike(clients.phone, like)))
      .orderBy(clients.name).limit(LIMIT),
    showSites
      ? db.select({ id: sites.id, name: sites.name, address: sites.address, archivedAt: sites.archivedAt }).from(sites)
          .where(or(ilike(sites.name, like), ilike(sites.address, like)))
          .orderBy(desc(sites.updatedAt)).limit(LIMIT)
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    quotes: quoteRows.map((r) => ({ ...r, title: r.title.trim() })),
    clients: clientRows,
    sites: siteRows.map(({ archivedAt, ...s }) => ({ ...s, name: s.name.trim(), archived: !!archivedAt })),
  } satisfies SearchResult);
}
