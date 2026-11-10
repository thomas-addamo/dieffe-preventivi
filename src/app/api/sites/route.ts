import { NextResponse } from "next/server";
import { requireSitesUser } from "@/lib/sites/guard";
import { queueSiteSyncOnRead } from "@/lib/sites/sync";
import { getSitesOverview } from "@/lib/sites/queries";

/**
 * Dashboard Gestione Cantieri: elenco dei cantieri in corso, punti sulla
 * mappa e panoramica. Risponde subito; l'allineamento con i preventivi e il
 * lavoro in sospeso (posizioni, fasi e SAL) proseguono dopo la risposta.
 */
export async function GET() {
  const auth = await requireSitesUser();
  if ("error" in auth) return auth.error;
  const overview = await getSitesOverview();
  queueSiteSyncOnRead(overview.pendingWork);
  return NextResponse.json(overview);
}
