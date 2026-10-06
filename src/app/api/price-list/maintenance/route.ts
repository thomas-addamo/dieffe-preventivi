import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { count, eq, isNull, lt, or, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { companySettings, priceListItems } from '@/lib/db/schema';
import { requireRole } from '@/lib/permissions/guard';
import { runPriceListMaintenance } from '@/lib/price-list/maintenance';

/** Stato del riordino: ultimo giro, conservazione, voci a rischio. */
export async function GET() {
  const { error } = await requireRole('admin', 'editor', 'viewer');
  if (error) return error;

  const [s] = await db
    .select({
      retentionMonths: companySettings.priceListRetentionMonths,
      maintainedAt: companySettings.priceListMaintainedAt,
      report: companySettings.priceListMaintenanceReport,
    })
    .from(companySettings)
    .limit(1);

  // Voci che verranno eliminate entro un mese se non vengono usate.
  const retention = s?.retentionMonths ?? 12;
  const soon = new Date();
  soon.setMonth(soon.getMonth() - retention + 1);
  const [atRisk] = await db
    .select({ value: count() })
    .from(priceListItems)
    .where(
      and(
        eq(priceListItems.pinned, false),
        or(
          lt(priceListItems.lastUsedAt, soon),
          and(isNull(priceListItems.lastUsedAt), lt(priceListItems.createdAt, soon))
        )
      )
    );

  return NextResponse.json({
    retentionMonths: retention,
    maintainedAt: s?.maintainedAt ?? null,
    report: s?.report ?? null,
    atRisk: atRisk?.value ?? 0,
  });
}

/** Riordino immediato (pulsante "Riordina ora"). */
export async function POST() {
  const { error, session } = await requireRole('admin', 'editor');
  if (error) return error;
  const report = await runPriceListMaintenance({ trigger: 'manual', userId: session.user.id });
  return NextResponse.json(report);
}

const patchSchema = z.object({ retentionMonths: z.number().int().min(3).max(60) });

/** Mesi di conservazione delle voci inutilizzate (solo admin). */
export async function PATCH(req: NextRequest) {
  const { error } = await requireRole('admin');
  if (error) return error;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Valore non valido' }, { status: 400 });
  const [s] = await db.select({ id: companySettings.id }).from(companySettings).limit(1);
  if (!s) return NextResponse.json({ error: 'Impostazioni mancanti' }, { status: 404 });
  await db
    .update(companySettings)
    .set({ priceListRetentionMonths: parsed.data.retentionMonths })
    .where(eq(companySettings.id, s.id));
  return NextResponse.json({ ok: true });
}
