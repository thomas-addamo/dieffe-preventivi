import { NextResponse } from "next/server";
import { requireSitesUser } from "@/lib/sites/guard";
import { getArchivedSites } from "@/lib/sites/queries";

/** Archivio: cantieri conclusi o con il preventivo tornato indietro. */
export async function GET() {
  const auth = await requireSitesUser();
  if ("error" in auth) return auth.error;
  return NextResponse.json(await getArchivedSites());
}
