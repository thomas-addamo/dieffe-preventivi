import "server-only";
import { sql, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sites, clients } from "@/lib/db/schema";
import { geocodeAddress } from "./geocode";
import { setupQuoteInSite } from "./setup";

/**
 * Lavoro "lento" dei cantieri, a piccoli lotti: posizione sulla mappa degli
 * indirizzi nuovi e preparazione (fasi + SAL) dei preventivi accettati.
 * Lo chiamano il cron notturno, le API dopo un cambio di stato e la
 * dashboard finché c'è qualcosa in sospeso. Restituisce quanto resta.
 */
export async function processPendingSites(
  opts: { maxGeocode?: number; maxSetup?: number; deadline?: number } = {}
): Promise<{ remaining: number }> {
  const { maxGeocode = 3, maxSetup = 2, deadline = Date.now() + 40_000 } = opts;

  const toGeocode = await db
    .select({ id: sites.id, address: sites.address, clientAddress: clients.address })
    .from(sites)
    .leftJoin(clients, eq(sites.clientId, clients.id))
    .where(eq(sites.geoStatus, "pending"))
    .limit(maxGeocode);

  for (const s of toGeocode) {
    if (Date.now() > deadline) break;
    const hit = s.address ? await geocodeAddress(s.address, { hint: s.clientAddress }) : null;
    await db
      .update(sites)
      .set(hit ? { lat: hit.lat, lng: hit.lng, geoStatus: "ok" } : { geoStatus: "failed" })
      .where(eq(sites.id, s.id));
  }

  const toSetup = (
    await db.execute<{ site_id: string; quote_id: string }>(sql`
      select s.id as site_id, q.id as quote_id
      from quotes q join sites s on s.id = q.site_id
      where s.status = 'active' and q.status = 'accepted' and q.site_setup_at is null and q.deleted_at is null
      order by (q.id = s.main_quote_id) desc, q.created_at
      limit ${maxSetup}`)
  ).rows;

  for (const r of toSetup) {
    if (Date.now() > deadline) break;
    try {
      await setupQuoteInSite(r.site_id, r.quote_id);
    } catch (err) {
      console.error("[sites] preparazione fallita:", err instanceof Error ? err.message : err);
    }
  }

  const [left] = (
    await db.execute<{ n: number }>(sql`
      select (select count(*) from sites where geo_status = 'pending')
           + (select count(*) from quotes q join sites s on s.id = q.site_id
              where s.status = 'active' and q.status = 'accepted' and q.site_setup_at is null and q.deleted_at is null)
        as n`)
  ).rows;
  return { remaining: Number(left?.n ?? 0) };
}
