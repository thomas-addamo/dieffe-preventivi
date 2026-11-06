import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sites } from "@/lib/db/schema";
import { requireSite } from "@/lib/sites/guard";
import { getSiteDetail } from "@/lib/sites/queries";
import { needsInsights } from "@/lib/sites/insights";
import { schedulePhases } from "@/lib/sites/schedule";
import { recomputeSite } from "@/lib/sites/recompute";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireSite(id);
  if ("error" in auth) return auth.error;
  const detail = await getSiteDetail(id);
  if (!detail) return NextResponse.json({ error: "Cantiere non trovato" }, { status: 404 });
  return NextResponse.json({ ...detail, insightsStale: needsInsights(detail) });
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  startDate: isoDate.nullable().optional(),
  plannedEndDate: isoDate.nullable().optional(),
  dailyCost: z.number().min(0).max(1_000_000).nullable().optional(),
  penaltyPerDay: z.number().min(0).max(1_000_000).nullable().optional(),
  marginPct: z.number().min(0).max(100).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  /** Ricalcola le date delle fasi dall'inizio lavori (e la fine prevista). */
  reschedule: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireSite(id, true);
  if ("error" in auth) return auth.error;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  const { reschedule, lat, lng, ...fields } = parsed.data;

  const set: Partial<typeof sites.$inferInsert> = { ...fields, updatedAt: new Date() };
  if (lat != null && lng != null) Object.assign(set, { lat, lng, geoStatus: "manual" });
  await db.update(sites).set(set).where(eq(sites.id, id));

  // Nuova data di inizio: le fasi si ridistribuiscono e, se l'utente non ha
  // indicato una fine, si propone quella del programma.
  if (fields.startDate !== undefined || reschedule) {
    await schedulePhases(id, { setPlannedEnd: !!reschedule || fields.plannedEndDate === undefined });
  }
  if (fields.startDate !== undefined) await recomputeSite(id);

  const detail = await getSiteDetail(id);
  return NextResponse.json({ ...detail, insightsStale: detail ? needsInsights(detail) : false });
}
