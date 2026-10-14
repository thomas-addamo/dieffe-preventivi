import "server-only";
import { after } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// ─────────────────────────────────────────────────────────────────────────────
// Allineamento automatico preventivi → cantieri.
//
// Regole:
//  • un preventivo PRINCIPALE inviato genera un cantiere "in attesa", se
//    accettato un cantiere "attivo"; bozze, rifiutati, archiviati e cestinati
//    non hanno cantiere (se lo avevano viene eliminato con tutto il contenuto);
//  • i lavori extra inviati/accettati confluiscono nel cantiere del principale;
//  • un preventivo con i lavori conclusi (works_completed_at) non genera più
//    un cantiere.
//
// Tutto in poche istruzioni set-based inviate con UN solo viaggio al DB
// (db.batch = una transazione HTTP): costa come una singola query e si può
// chiamare spesso senza pesare su Neon.
// ─────────────────────────────────────────────────────────────────────────────

const LIVE = sql`('sent','accepted')`;

export async function syncSites(): Promise<void> {
  await db.batch([
    // 1. Cantieri il cui preventivo principale non è più inviato/accettato.
    db.execute(sql`
      update quotes set site_setup_at = null
      where site_id in (
        select s.id from sites s join quotes q on q.id = s.main_quote_id
        where q.deleted_at is not null or q.status not in ${LIVE} or q.works_completed_at is not null
      )`),
    db.execute(sql`
      delete from sites s using quotes q
      where q.id = s.main_quote_id
        and (q.deleted_at is not null or q.status not in ${LIVE} or q.works_completed_at is not null)`),

    // 2. Nuovi cantieri dai preventivi principali inviati/accettati.
    db.execute(sql`
      insert into sites (id, status, main_quote_id, client_id, name, address, geo_status)
      select md5(random()::text || q.id || clock_timestamp()::text),
             case when q.status = 'accepted' then 'active' else 'pending' end,
             q.id, q.client_id, q.title, q.project_address,
             case when coalesce(trim(q.project_address), '') = '' then 'failed' else 'pending' end
      from quotes q
      where q.kind = 'standard' and q.deleted_at is null and q.status in ${LIVE}
        and q.works_completed_at is null
        and not exists (select 1 from sites s where s.main_quote_id = q.id)
      on conflict do nothing`),

    // 3. Stato, cliente e indirizzo seguono il preventivo principale.
    db.execute(sql`
      update sites s set
        status = case when q.status = 'accepted' then 'active' else 'pending' end,
        client_id = q.client_id,
        address = q.project_address,
        geo_status = case
          when s.address is distinct from q.project_address and s.geo_status <> 'manual'
            then case when coalesce(trim(q.project_address), '') = '' then 'failed' else 'pending' end
          else s.geo_status end,
        updated_at = now()
      from quotes q
      where q.id = s.main_quote_id
        and (s.status <> case when q.status = 'accepted' then 'active' else 'pending' end
             or s.client_id is distinct from q.client_id
             or s.address is distinct from q.project_address)`),

    // 4. Lavori extra non più validi: via le loro fasi/SAL e lo scollegamento.
    db.execute(sql`
      delete from site_phases where quote_id in (
        select id from quotes where kind = 'extra' and site_id is not null
          and (deleted_at is not null or status not in ${LIVE}))`),
    db.execute(sql`
      delete from site_milestones where quote_id in (
        select id from quotes where kind = 'extra' and site_id is not null
          and (deleted_at is not null or status not in ${LIVE}))`),
    db.execute(sql`
      update quotes set site_id = null, site_setup_at = null
      where kind = 'extra' and site_id is not null and (deleted_at is not null or status not in ${LIVE})`),

    // 5. Collegamento dei preventivi (principale + extra validi) al cantiere.
    db.execute(sql`
      update quotes q set site_id = s.id
      from sites s
      where (q.id = s.main_quote_id
             or (q.kind = 'extra' and q.parent_quote_id = s.main_quote_id
                 and q.deleted_at is null and q.status in ${LIVE}))
        and q.site_id is distinct from s.id`),
  ]);
}

/**
 * Da chiamare nelle API che cambiano lo stato di un preventivo: allinea i
 * cantieri e prepara quelli nuovi DOPO aver risposto (l'utente non aspetta).
 */
export function queueSiteSync() {
  after(async () => {
    try {
      await syncSites();
      const { processPendingSites } = await import("./process");
      await processPendingSites({ maxGeocode: 2, maxSetup: 1 });
    } catch (err) {
      console.error("[sites] sync fallita:", err instanceof Error ? err.message : err);
    }
  });
}
