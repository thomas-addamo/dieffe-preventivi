import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { updateQuoteField, checkQuoteEditable } from "@/lib/db/quotes";
import { notifyQuoteStatusChanged } from "@/lib/notifications";
import { QUOTE_STATUS_LABELS } from "@/lib/utils";
import { queueSiteSync } from "@/lib/sites/sync";

const schema = z.object({
  status: z.enum(["draft", "sent", "accepted", "rejected", "archived"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;
  const guard = await checkQuoteEditable(id, session.user.role, { statusChange: true });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Stato non valido" }, { status: 400 });

  const extra: Record<string, string | null> = {};
  if (parsed.data.status === "sent") extra.sentAt = new Date().toISOString();

  // Cambiando stato lo sblocco manuale di un blocco automatico decade (B1):
  // es. sbloccato da inviato per correggerlo → rimesso inviato → di nuovo bloccato.
  const statusChanged = parsed.data.status !== guard.quote.status;
  await updateQuoteField(id, {
    status: parsed.data.status,
    ...extra,
    ...(statusChanged ? { lockOverrideAt: null, lockOverrideBy: null, unlockRequestedAt: null, unlockRequestedBy: null } : {}),
  } as never);
  // Inviato/accettato → cantiere; altri stati → il cantiere sparisce.
  queueSiteSync();

  await notifyQuoteStatusChanged({
    quoteId: id,
    quoteCode: guard.quote.code,
    ownerUserId: guard.quote.userId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    newStatusLabel: QUOTE_STATUS_LABELS[parsed.data.status] ?? parsed.data.status,
  });

  return NextResponse.json({ ok: true });
}
