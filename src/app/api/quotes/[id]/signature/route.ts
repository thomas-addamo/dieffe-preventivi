import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { quotes, quoteSignatures, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role !== "admin")
    return NextResponse.json({ error: "Permessi insufficienti — solo admin" }, { status: 403 });

  const { id } = await params;

  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!quote) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  if (quote.status !== "accepted" && quote.status !== "rejected") {
    return NextResponse.json({ error: "Il preventivo non è in stato accettato o rifiutato" }, { status: 400 });
  }

  const [sig] = await db
    .select({ signerName: quoteSignatures.signerName })
    .from(quoteSignatures)
    .where(eq(quoteSignatures.quoteId, id))
    .limit(1);

  await db.delete(quoteSignatures).where(eq(quoteSignatures.quoteId, id));

  await db
    .update(quotes)
    .set({
      status: "sent",
      publicToken: null,
      publicTokenExpiresAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(quotes.id, id));

  await db.insert(auditLog).values({
    id: generateId(),
    userId: session.user.id,
    action: "quote.signature_revoked",
    entityType: "quote",
    entityId: id,
    changes: {
      previousStatus: quote.status,
      newStatus: "sent",
      signerName: sig?.signerName ?? null,
      revokedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ success: true });
}
