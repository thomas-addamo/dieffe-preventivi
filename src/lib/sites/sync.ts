import "server-only";
import { after } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { SITES_BACKGROUND } from "@/lib/features";

// ─────────────────────────────────────────────────────────────────────────────
// Allineamento automatico preventivi → cantieri.
//
// Regole:
//  • un preventivo PRINCIPALE inviato genera un cantiere "in attesa", se
//    accettato un cantiere "attivo"; i lavori extra inviati/accettati
//    confluiscono nel cantiere del principale;
//  • se il principale torna indietro (bozza, rifiutato, archiviato, cestinato)
//    il cantiere va in ARCHIVIO ("withdrawn") con tutto ciò che contiene e
//    torna in corso da solo se il preventivo torna inviato/accettato. Solo un
//    cantiere VUOTO (nessuna nota, evento, foto, fase spuntata, SAL fatturato
//    o data di inizio) viene eliminato, per non riempire l'archivio;
//  • un lavoro extra che torna indietro perde fasi e SAL solo se nessuno ci
//    ha ancora lavorato (fasi spuntate, SAL fatturati/incassati);
//  • i cantieri con i lavori conclusi ("completed") restano in archivio
//    finché non si riaprono a mano.
//
// Tutto in poche istruzioni set-based inviate con UN solo viaggio al DB
// (db.batch = una transazione HTTP).
// ─────────────────────────────────────────────────────────────────────────────

const LIVE = sql`('sent','accepted')`;

/** Preventivo (alias q) non più valido per un cantiere. */
const GONE = sql`(q.deleted_at is not null or q.status not in ${LIVE})`;

/** Cantiere (alias s) su cui qualcuno ha già lavorato. */
const HAS_WORK = sql`(
  s.start_date is not null
  or exists (select 1 from site_notes n where n.site_id = s.id)
  or exists (select 1 from site_events e where e.site_id = s.id)
  or exists (select 1 from site_photos f where f.site_id = s.id)
  or exists (select 1 from site_phases p where p.site_id = s.id and p.done_at is not null)
  or exists (select 1 from site_milestones m where m.site_id = s.id and (m.invoiced_at is not null or m.paid_at is not null))
)`;

/** Lavoro extra (alias x) su cui qualcuno ha già lavorato. */
const EXTRA_HAS_WORK = sql`(
  exists (select 1 from site_phases p where p.quote_id = x.id and p.done_at is not null)
  or exists (select 1 from site_milestones m where m.quote_id = x.id and (m.invoiced_at is not null or m.paid_at is not null))
)`;

const EXTRA_GONE = sql`x.kind = 'extra' and x.site_id is not null
  and (x.deleted_at is not null or x.status not in ${LIVE})
  and not ${EXTRA_HAS_WORK}`;

export async function syncSites(): Promise<void> {
  if (!SITES_BACKGROUND) return;
  await db.batch([
    // 1. Principale tornato indietro, cantiere vuoto e in corso: si elimina.
    db.execute(sql`
      update quotes set site_setup_at = null
      where site_id in (
        select s.id from sites s join quotes q on q.id = s.main_quote_id
        where s.archived_at is null and ${GONE} and not ${HAS_WORK}
      )`),
    db.execute(sql`
      delete from sites s using quotes q
      where q.id = s.main_quote_id and s.archived_at is null and ${GONE} and not ${HAS_WORK}`),

    // 2. Principale tornato indietro, cantiere con del lavoro: in archivio.
    db.execute(sql`
      update sites s set archived_at = now(), archive_reason = 'withdrawn', updated_at = now()
      from quotes q
      where q.id = s.main_quote_id and s.archived_at is null and ${GONE}`),

    // 3. Principale di nuovo inviato/accettato: il cantiere torna in corso.
    db.execute(sql`
      update sites s set archived_at = null, archive_reason = null, updated_at = now()
      from quotes q
      where q.id = s.main_quote_id and s.archive_reason = 'withdrawn'
        and q.deleted_at is null and q.status in ${LIVE} and q.works_completed_at is null`),

    // 4. Nuovi cantieri dai preventivi principali inviati/accettati.
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

    // 5. Stato, cliente e indirizzo seguono il preventivo principale
    //    (non per i cantieri conclusi: restano come al momento della chiusura).
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
        and s.archive_reason is distinct from 'completed'
        and q.deleted_at is null and q.status in ${LIVE}
        and (s.status <> case when q.status = 'accepted' then 'active' else 'pending' end
             or s.client_id is distinct from q.client_id
             or s.address is distinct from q.project_address)`),

    // 6. Lavori extra non più validi e mai lavorati: via fasi/SAL e scollegamento.
    db.execute(sql`delete from site_phases where quote_id in (select x.id from quotes x where ${EXTRA_GONE})`),
    db.execute(sql`delete from site_milestones where quote_id in (select x.id from quotes x where ${EXTRA_GONE})`),
    db.execute(sql`update quotes x set site_id = null, site_setup_at = null where ${EXTRA_GONE}`),

    // 7. Collegamento dei preventivi (principale + extra validi) al cantiere.
    db.execute(sql`
      update quotes q set site_id = s.id
      from sites s
      where (q.id = s.main_quote_id
             or (q.kind = 'extra' and q.parent_quote_id = s.main_quote_id
                 and q.deleted_at is null and q.status in ${LIVE}))
        and q.site_id is distinct from s.id`),
  ]);
}

// ── Quando allineare ──────────────────────────────────────────────────────────

/** Ultimo allineamento fatto da questa istanza del server (ms). */
let lastSync = 0;
let running: Promise<void> | null = null;
/** Le letture riallineano al massimo ogni 2 minuti: i cambi di stato lo fanno subito. */
const READ_SYNC_INTERVAL = 2 * 60_000;

async function syncAndProcess(opts: { maxGeocode: number; maxSetup: number }) {
  if (running) return running;
  running = (async () => {
    try {
      await syncSites();
      lastSync = Date.now();
      const { processPendingSites } = await import("./process");
      await processPendingSites({ ...opts, deadline: Date.now() + 25_000 });
    } catch (err) {
      console.error("[sites] sync fallita:", err instanceof Error ? err.message : err);
    } finally {
      running = null;
    }
  })();
  return running;
}

/**
 * Da chiamare nelle API che cambiano lo stato di un preventivo: allinea i
 * cantieri e prepara quelli nuovi DOPO aver risposto (l'utente non aspetta).
 */
export function queueSiteSync() {
  if (!SITES_BACKGROUND) return;
  after(() => syncAndProcess({ maxGeocode: 2, maxSetup: 1 }));
}

/**
 * Rete di sicurezza per le letture (dashboard, iPhone): se da questa istanza
 * non si allinea da un po', lo fa DOPO aver risposto, insieme a un lotto del
 * lavoro in sospeso (posizioni, fasi e SAL). Le letture non aspettano mai.
 */
export function queueSiteSyncOnRead(pendingWork = 0) {
  if (!SITES_BACKGROUND) return;
  if (Date.now() - lastSync < READ_SYNC_INTERVAL && pendingWork <= 0) return;
  after(() => syncAndProcess({ maxGeocode: 3, maxSetup: 1 }));
}
