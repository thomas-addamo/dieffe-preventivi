import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { notifyUsers } from "@/lib/notifications";
import { syncSites } from "./sync";
import { processPendingSites } from "./process";
import { recomputeSite } from "./recompute";
import { autoCompleteSites } from "./complete";
import { isoDay, toDay } from "./metrics";

const EVENT_LABEL: Record<string, string> = {
  suolo_pubblico: "Suolo pubblico",
  intervento: "Intervento",
  consegna: "Consegna",
  sopralluogo: "Sopralluogo",
  scadenza: "Scadenza",
  altro: "Evento",
};

/**
 * Giro notturno dei cantieri (dentro il cron già esistente):
 *  1. allinea cantieri e preventivi, completa posizioni e preparazioni;
 *  2. SAL "a inizio lavori" che scattano oggi;
 *  3. promemoria degli eventi di domani;
 *  4. chiusura automatica dei cantieri finiti e fatturati (→ eliminati).
 */
export async function runSitesMaintenance(deadline = Date.now() + 45_000) {
  await syncSites();

  let remaining = 1;
  while (remaining > 0 && Date.now() < deadline - 8_000) {
    ({ remaining } = await processPendingSites({ maxGeocode: 5, maxSetup: 2, deadline: deadline - 8_000 }));
  }

  const starting = (
    await db.execute<{ id: string }>(sql`
      select distinct s.id from sites s join site_milestones m on m.site_id = s.id
      where s.status = 'active' and m.trigger = 'start' and m.reached_at is null
        and s.start_date is not null and s.start_date <= current_date`)
  ).rows;
  for (const r of starting) await recomputeSite(r.id);

  const tomorrow = isoDay(toDay(new Date()) + 1);
  const events = (
    await db.execute<{ site_id: string; site_name: string; title: string; type: string; owner: string }>(sql`
      select e.site_id, s.name as site_name, e.title, e.type, q.user_id as owner
      from site_events e join sites s on s.id = e.site_id join quotes q on q.id = s.main_quote_id
      where e.date = ${tomorrow}`)
  ).rows;
  if (events.length) {
    const admins = (await db.execute<{ id: string }>(sql`select id from users where role = 'admin' and disabled = false`)).rows;
    for (const e of events) {
      await notifyUsers([e.owner, ...admins.map((a) => a.id)], {
        type: "site",
        title: `Domani · ${e.site_name}`,
        body: `${EVENT_LABEL[e.type] ?? "Evento"}: ${e.title}`,
        link: `/cantieri/${e.site_id}?tab=calendario`,
      });
    }
  }

  const completed = await autoCompleteSites();
  return { pending: remaining, startTriggers: starting.length, reminders: events.length, completed };
}
