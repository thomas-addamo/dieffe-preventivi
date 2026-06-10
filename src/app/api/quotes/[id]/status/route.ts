import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { updateQuoteField, checkQuoteEditable } from "@/lib/db/quotes";
import { notifyQuoteStatusChanged } from "@/lib/notifications";
import { QUOTE_STATUS_LABELS } from "@/lib/utils";

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
  const guard = await checkQuoteEditable(id, session.user.role);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Stato non valido" }, { status: 400 });

  const extra: Record<string, string | null> = {};
  if (parsed.data.status === "sent") extra.sentAt = new Date().toISOString();

  await updateQuoteField(id, { status: parsed.data.status, ...extra } as never);

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
