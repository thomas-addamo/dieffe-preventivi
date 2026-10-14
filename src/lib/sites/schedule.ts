import "server-only";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sites, sitePhases } from "@/lib/db/schema";
import { isoDay, toDay } from "./metrics";

/** Aggiunge giorni lavorativi (lun–ven) a un giorno di calendario. */
export function addWorkdays(day: number, workdays: number): number {
  let d = day;
  let left = Math.max(0, workdays);
  while (left > 0) {
    d += 1;
    const wd = new Date(d * 86_400_000).getUTCDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d;
}

/**
 * Distribuisce le fasi in sequenza dalla data di inizio lavori, in giorni
 * lavorativi, e (se non impostata) propone la data di fine prevista.
 * Un'unica scrittura per fase, solo dove le date cambiano.
 */
export async function schedulePhases(siteId: string, opts: { setPlannedEnd?: boolean } = {}) {
  const [site] = await db
    .select({ startDate: sites.startDate, plannedEndDate: sites.plannedEndDate })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);
  if (!site?.startDate) return;

  const phases = await db
    .select({ id: sitePhases.id, durationDays: sitePhases.durationDays, plannedStart: sitePhases.plannedStart, plannedEnd: sitePhases.plannedEnd })
    .from(sitePhases)
    .where(eq(sitePhases.siteId, siteId))
    .orderBy(asc(sitePhases.orderIndex));

  let cursor = toDay(site.startDate);
  let lastEndDay: number | null = null;
  const updates = [];
  for (const p of phases) {
    const start = cursor;
    const end = addWorkdays(start, Math.max(1, p.durationDays ?? 1) - 1);
    const ps = isoDay(start), pe = isoDay(end);
    if (p.plannedStart !== ps || p.plannedEnd !== pe) {
      updates.push(db.update(sitePhases).set({ plannedStart: ps, plannedEnd: pe }).where(eq(sitePhases.id, p.id)));
    }
    lastEndDay = end;
    cursor = addWorkdays(end, 1);
  }
  const lastEnd = lastEndDay != null ? isoDay(lastEndDay) : null;
  if (lastEnd && (opts.setPlannedEnd || !site.plannedEndDate)) {
    updates.push(db.update(sites).set({ plannedEndDate: lastEnd }).where(eq(sites.id, siteId)));
  }
  if (updates.length) await db.batch(updates as [(typeof updates)[number], ...typeof updates]);
}
