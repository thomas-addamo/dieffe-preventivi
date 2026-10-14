import { NextResponse } from "next/server";
import { requireSitesUser } from "@/lib/sites/guard";
import { syncSites } from "@/lib/sites/sync";
import { getSitesOverview } from "@/lib/sites/queries";

/** Dashboard Gestione Cantieri: elenco, punti sulla mappa e panoramica. */
export async function GET() {
  const auth = await requireSitesUser();
  if ("error" in auth) return auth.error;
  // Rete di sicurezza: un solo viaggio al DB, i cantieri sono sempre allineati.
  await syncSites();
  return NextResponse.json(await getSitesOverview());
}
