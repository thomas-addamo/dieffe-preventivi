import "server-only";
import { z } from "zod";
import { and, eq, sql, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sitePhases, siteMilestones, siteEvents, siteNotes, SITE_EVENT_TYPES } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { recomputeSite } from "./recompute";
import { schedulePhases } from "./schedule";

// ─────────────────────────────────────────────────────────────────────────────
// Elementi di un cantiere: fasi, SAL, eventi del calendario, note.
// Ogni modifica che tocca l'avanzamento ricalcola il cantiere (e quindi i SAL
// da fatturare); le altre scrivono una sola riga.
// ─────────────────────────────────────────────────────────────────────────────

export const ENTITIES = ["phases", "milestones", "events", "notes"] as const;
export type Entity = (typeof ENTITIES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max: number) => z.string().trim().min(1).max(max);

const phaseCreate = z.object({
  title: text(80),
  weight: z.number().min(0).max(100_000_000).optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
  note: z.string().max(2000).nullable().optional(),
});
const phasePatch = phaseCreate.partial().extend({
  done: z.boolean().optional(),
  plannedStart: isoDate.nullable().optional(),
  plannedEnd: isoDate.nullable().optional(),
  /** Sposta la fase su (-1) o giù (+1) nella sequenza. */
  move: z.union([z.literal(-1), z.literal(1)]).optional(),
});

const milestoneCreate = z.object({
  label: text(80),
  percent: z.number().min(0).max(100).nullable().optional(),
  amount: z.number().min(0).max(100_000_000).nullable().optional(),
  trigger: z.enum(["accept", "start", "phase", "end", "manual"]).optional(),
  phaseId: z.string().nullable().optional(),
});
const milestonePatch = milestoneCreate.partial().extend({
  reached: z.boolean().optional(),
  invoiced: z.boolean().optional(),
  invoiceNumber: z.string().max(40).nullable().optional(),
  paid: z.boolean().optional(),
});

const eventCreate = z.object({
  date: isoDate,
  endDate: isoDate.nullable().optional(),
  type: z.enum(SITE_EVENT_TYPES),
  title: text(120),
  notes: z.string().max(2000).nullable().optional(),
});
const eventPatch = eventCreate.partial();

const noteCreate = z.object({ body: text(4000) });

type Result = { ok: true; data?: unknown } | { ok: false; status: number; error: string };
const bad = (error = "Dati non validi"): Result => ({ ok: false, status: 400, error });

async function nextOrder(table: typeof sitePhases | typeof siteMilestones, siteId: string) {
  const [r] = await db
    .select({ n: sql<number>`coalesce(max(${table.orderIndex}), -1)::int + 1` })
    .from(table)
    .where(eq(table.siteId, siteId));
  return r?.n ?? 0;
}

export async function createEntity(siteId: string, entity: Entity, body: unknown, userId: string): Promise<Result> {
  switch (entity) {
    case "phases": {
      const p = phaseCreate.safeParse(body);
      if (!p.success) return bad();
      const row = { id: generateId(), siteId, ...p.data, weight: p.data.weight ?? 0, orderIndex: await nextOrder(sitePhases, siteId), source: "manual" as const };
      await db.insert(sitePhases).values(row);
      await schedulePhases(siteId);
      await recomputeSite(siteId);
      return { ok: true, data: row };
    }
    case "milestones": {
      const p = milestoneCreate.safeParse(body);
      if (!p.success || (p.data.percent == null && p.data.amount == null)) return bad("Indica percentuale o importo");
      const trigger = p.data.trigger ?? (p.data.phaseId ? "phase" : "manual");
      const row = { id: generateId(), siteId, ...p.data, trigger, orderIndex: await nextOrder(siteMilestones, siteId) };
      await db.insert(siteMilestones).values(row);
      await recomputeSite(siteId);
      return { ok: true, data: row };
    }
    case "events": {
      const p = eventCreate.safeParse(body);
      if (!p.success) return bad();
      const row = { id: generateId(), siteId, ...p.data };
      await db.insert(siteEvents).values(row);
      return { ok: true, data: row };
    }
    case "notes": {
      const p = noteCreate.safeParse(body);
      if (!p.success) return bad();
      const row = { id: generateId(), siteId, body: p.data.body, userId };
      await db.insert(siteNotes).values(row);
      return { ok: true, data: row };
    }
  }
}

export async function updateEntity(siteId: string, entity: Entity, itemId: string, body: unknown): Promise<Result> {
  switch (entity) {
    case "phases": {
      const p = phasePatch.safeParse(body);
      if (!p.success) return bad();
      const { done, move, ...fields } = p.data;
      const where = and(eq(sitePhases.id, itemId), eq(sitePhases.siteId, siteId));

      if (move) {
        const list = await db.select({ id: sitePhases.id, orderIndex: sitePhases.orderIndex }).from(sitePhases).where(eq(sitePhases.siteId, siteId)).orderBy(asc(sitePhases.orderIndex));
        const i = list.findIndex((x) => x.id === itemId);
        const j = i + move;
        if (i < 0 || j < 0 || j >= list.length) return { ok: true };
        [list[i], list[j]] = [list[j], list[i]];
        // Rinumera solo le righe la cui posizione cambia (0, 1, 2…).
        const writes = list
          .map((x, k) => (x.orderIndex === k ? null : db.update(sitePhases).set({ orderIndex: k }).where(eq(sitePhases.id, x.id))))
          .filter((w) => w !== null);
        if (writes.length) await db.batch(writes as [(typeof writes)[number], ...typeof writes]);
        await schedulePhases(siteId);
        return { ok: true };
      }

      const set: Partial<typeof sitePhases.$inferInsert> = { ...fields };
      if (done !== undefined) set.doneAt = done ? new Date() : null;
      if (Object.keys(set).length) await db.update(sitePhases).set(set).where(where);
      if (fields.durationDays !== undefined) await schedulePhases(siteId);
      if (done !== undefined || fields.weight !== undefined) await recomputeSite(siteId);

      // Tutte le fasi completate → l'interfaccia propone di concludere i lavori.
      const [r] = await db
        .select({ open: sql<number>`count(*) filter (where ${sitePhases.doneAt} is null)::int`, total: sql<number>`count(*)::int` })
        .from(sitePhases)
        .where(eq(sitePhases.siteId, siteId));
      return { ok: true, data: { allDone: r.total > 0 && r.open === 0 } };
    }
    case "milestones": {
      const p = milestonePatch.safeParse(body);
      if (!p.success) return bad();
      const { reached, invoiced, paid, ...fields } = p.data;
      const set: Partial<typeof siteMilestones.$inferInsert> = { ...fields };
      if (fields.phaseId !== undefined && fields.trigger === undefined) set.trigger = fields.phaseId ? "phase" : "manual";
      if (reached !== undefined) set.reachedAt = reached ? new Date() : null;
      if (invoiced !== undefined) {
        set.invoicedAt = invoiced ? new Date() : null;
        if (invoiced && reached === undefined) set.reachedAt = sql`coalesce(${siteMilestones.reachedAt}, now())` as never;
        if (!invoiced) set.paidAt = null;
      }
      if (paid !== undefined) {
        set.paidAt = paid ? new Date() : null;
        if (paid && invoiced === undefined) set.invoicedAt = sql`coalesce(${siteMilestones.invoicedAt}, now())` as never;
      }
      await db.update(siteMilestones).set(set).where(and(eq(siteMilestones.id, itemId), eq(siteMilestones.siteId, siteId)));
      if (fields.trigger !== undefined || fields.phaseId !== undefined) await recomputeSite(siteId);
      return { ok: true };
    }
    case "events": {
      const p = eventPatch.safeParse(body);
      if (!p.success) return bad();
      await db.update(siteEvents).set(p.data).where(and(eq(siteEvents.id, itemId), eq(siteEvents.siteId, siteId)));
      return { ok: true };
    }
    case "notes":
      return bad("Le note non si modificano");
  }
}

export async function deleteEntity(siteId: string, entity: Entity, itemId: string, user: { id: string; role: string }): Promise<Result> {
  switch (entity) {
    case "phases":
      await db.delete(sitePhases).where(and(eq(sitePhases.id, itemId), eq(sitePhases.siteId, siteId)));
      await schedulePhases(siteId);
      await recomputeSite(siteId);
      return { ok: true };
    case "milestones":
      await db.delete(siteMilestones).where(and(eq(siteMilestones.id, itemId), eq(siteMilestones.siteId, siteId)));
      return { ok: true };
    case "events":
      await db.delete(siteEvents).where(and(eq(siteEvents.id, itemId), eq(siteEvents.siteId, siteId)));
      return { ok: true };
    case "notes": {
      const [n] = await db.select({ userId: siteNotes.userId }).from(siteNotes).where(and(eq(siteNotes.id, itemId), eq(siteNotes.siteId, siteId))).limit(1);
      if (!n) return { ok: true };
      if (n.userId !== user.id && user.role !== "admin") return { ok: false, status: 403, error: "Puoi eliminare solo le tue note" };
      await db.delete(siteNotes).where(eq(siteNotes.id, itemId));
      return { ok: true };
    }
  }
}
