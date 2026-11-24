import "server-only";
import { z } from "zod";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quotes, siteNotes, sitePhotos, users } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { isLogisticsLevel } from "./logistics";

// ─────────────────────────────────────────────────────────────────────────────
// Pannello «Sopralluogo» del preventivo: annotazioni, foto e logistica di
// cantiere, disponibili già sulla bozza, prima che il cantiere esista.
// Note e foto stanno nelle stesse tabelle del cantiere (site_notes,
// site_photos) con quote_id: quando il preventivo diventa cantiere la
// sincronizzazione (sync.ts, passi 8–9) le mette nelle Note e Foto del cantiere,
// senza copiarle. Il pannello mostra quelle del preventivo e, se il cantiere
// c'è già, anche quelle aggiunte dalla pagina cantiere.
// La logistica è un numero sul preventivo principale (un lavoro extra usa quella
// del suo principale: il cantiere è lo stesso).
// Le annotazioni non sono parte del preventivo: si scrivono anche se è bloccato.
// ─────────────────────────────────────────────────────────────────────────────

type Result = { ok: true; data?: unknown } | { ok: false; status: number; error: string };
type User = { id: string; role: string };

export type BoardQuote = { id: string; siteId: string | null; logisticsQuoteId: string };

/** Preventivo vivo con il suo cantiere e il preventivo che tiene la logistica. */
export async function loadBoardQuote(id: string): Promise<BoardQuote | null> {
  const [q] = await db
    .select({ id: quotes.id, siteId: quotes.siteId, kind: quotes.kind, parentQuoteId: quotes.parentQuoteId })
    .from(quotes)
    .where(and(eq(quotes.id, id), isNull(quotes.deletedAt)))
    .limit(1);
  if (!q) return null;
  return { id: q.id, siteId: q.siteId, logisticsQuoteId: q.kind === "extra" && q.parentQuoteId ? q.parentQuoteId : q.id };
}

/** Note e foto del preventivo (e del suo cantiere): due letture su indice, in parallelo. */
export async function getSurveyBoard(q: BoardQuote) {
  const noteScope = q.siteId ? or(eq(siteNotes.quoteId, q.id), eq(siteNotes.siteId, q.siteId)) : eq(siteNotes.quoteId, q.id);
  const photoScope = q.siteId ? or(eq(sitePhotos.quoteId, q.id), eq(sitePhotos.siteId, q.siteId)) : eq(sitePhotos.quoteId, q.id);
  const [[logistics], notes, photos] = await Promise.all([
    db
      .select({ level: quotes.siteLogistics, at: quotes.siteLogisticsAt, userName: users.name })
      .from(quotes)
      .leftJoin(users, eq(users.id, quotes.siteLogisticsBy))
      .where(eq(quotes.id, q.logisticsQuoteId))
      .limit(1),
    db
      .select({
        id: siteNotes.id,
        body: siteNotes.body,
        createdAt: siteNotes.createdAt,
        updatedAt: siteNotes.updatedAt,
        userId: siteNotes.userId,
        userName: users.name,
      })
      .from(siteNotes)
      .leftJoin(users, eq(users.id, siteNotes.userId))
      .where(noteScope)
      .orderBy(desc(siteNotes.createdAt))
      .limit(200),
    db
      .select({
        id: sitePhotos.id,
        url: sitePhotos.url,
        width: sitePhotos.width,
        height: sitePhotos.height,
        caption: sitePhotos.caption,
        /** Foto del preventivo (si elimina da qui) o del cantiere (dalla pagina cantiere). */
        quoteId: sitePhotos.quoteId,
        createdAt: sitePhotos.createdAt,
        userId: sitePhotos.userId,
        userName: users.name,
      })
      .from(sitePhotos)
      .leftJoin(users, eq(users.id, sitePhotos.userId))
      .where(photoScope)
      .orderBy(desc(sitePhotos.createdAt))
      .limit(300),
  ]);
  return {
    siteId: q.siteId,
    logistics: logistics?.level ?? null,
    logisticsAt: logistics?.at ?? null,
    logisticsBy: logistics?.userName ?? null,
    notes,
    photos,
  };
}

export type SurveyBoard = Awaited<ReturnType<typeof getSurveyBoard>>;

export async function setLogistics(q: BoardQuote, level: unknown, user: User): Promise<Result> {
  if (level !== null && !isLogisticsLevel(level)) return { ok: false, status: 400, error: "Livello non valido" };
  await db
    .update(quotes)
    .set(level === null ? { siteLogistics: null, siteLogisticsAt: null, siteLogisticsBy: null } : { siteLogistics: level, siteLogisticsAt: new Date(), siteLogisticsBy: user.id })
    .where(eq(quotes.id, q.logisticsQuoteId));
  return { ok: true, data: { logistics: level } };
}

const noteBody = z.object({ body: z.string().trim().min(1).max(4000) });

export async function addSurveyNote(q: BoardQuote, body: unknown, user: User): Promise<Result> {
  const p = noteBody.safeParse(body);
  if (!p.success) return { ok: false, status: 400, error: "Scrivi il testo della nota" };
  const row = { id: generateId(), quoteId: q.id, siteId: q.siteId, body: p.data.body, userId: user.id, createdAt: new Date() };
  await db.insert(siteNotes).values(row);
  return { ok: true, data: { ...row, updatedAt: null } };
}

/** Nota del pannello: del preventivo o del suo cantiere. */
async function findNote(q: BoardQuote, noteId: string) {
  const scope = q.siteId ? or(eq(siteNotes.quoteId, q.id), eq(siteNotes.siteId, q.siteId)) : eq(siteNotes.quoteId, q.id);
  const [n] = await db.select({ userId: siteNotes.userId }).from(siteNotes).where(and(eq(siteNotes.id, noteId), scope)).limit(1);
  return n ?? null;
}

export async function updateSurveyNote(q: BoardQuote, noteId: string, body: unknown, user: User): Promise<Result> {
  const p = noteBody.safeParse(body);
  if (!p.success) return { ok: false, status: 400, error: "Scrivi il testo della nota" };
  const n = await findNote(q, noteId);
  if (!n) return { ok: false, status: 404, error: "Nota non trovata" };
  if (n.userId !== user.id && user.role !== "admin") return { ok: false, status: 403, error: "Puoi modificare solo le tue note" };
  const updatedAt = new Date();
  await db.update(siteNotes).set({ body: p.data.body, updatedAt }).where(eq(siteNotes.id, noteId));
  return { ok: true, data: { id: noteId, body: p.data.body, updatedAt } };
}

export async function deleteSurveyNote(q: BoardQuote, noteId: string, user: User): Promise<Result> {
  const n = await findNote(q, noteId);
  if (!n) return { ok: true };
  if (n.userId !== user.id && user.role !== "admin") return { ok: false, status: 403, error: "Puoi eliminare solo le tue note" };
  await db.delete(siteNotes).where(eq(siteNotes.id, noteId));
  return { ok: true };
}

/** Numero di annotazioni e foto per il tasto del pannello: una sola lettura su indice. */
export async function countSurveyBoard(quoteId: string, siteId: string | null): Promise<number> {
  const site = siteId ?? "";
  const [row] = await db.execute<{ n: number }>(sql`
    select (select count(*) from site_notes where quote_id = ${quoteId} or site_id = ${site})
         + (select count(*) from site_photos where quote_id = ${quoteId} or site_id = ${site}) as n`).then((r) => r.rows);
  return Number(row?.n ?? 0);
}
