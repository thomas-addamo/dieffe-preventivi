import { NextResponse } from "next/server";
import { requireSitesUser } from "@/lib/sites/guard";
import { getQuoteSite } from "@/lib/sites/quote-site";

/**
 * Cantiere collegato al preventivo: `{ site: { id, name, status, archivedAt,
 * archiveReason } | null }`. Se il preventivo è inviato o accettato e il
 * cantiere non c'è ancora, lo crea subito. Lo usano sito e iPhone.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSitesUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { found, site } = await getQuoteSite(id);
  if (!found) return NextResponse.json({ error: "Preventivo non trovato" }, { status: 404 });
  return NextResponse.json({ site });
}
