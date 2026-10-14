import { NextResponse } from "next/server";
import { requireSitesUser } from "@/lib/sites/guard";
import { processPendingSites } from "@/lib/sites/process";

export const maxDuration = 60;

/**
 * Avanza il lavoro in sospeso (posizioni, fasi/SAL dei preventivi accettati)
 * a piccoli lotti. La dashboard lo richiama finché `remaining` > 0.
 */
export async function POST() {
  const auth = await requireSitesUser();
  if ("error" in auth) return auth.error;
  const result = await processPendingSites({ maxGeocode: 3, maxSetup: 1, deadline: Date.now() + 30_000 });
  return NextResponse.json(result);
}
