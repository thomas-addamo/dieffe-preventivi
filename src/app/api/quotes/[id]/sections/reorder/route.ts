import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quoteSections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { checkQuoteEditable } from "@/lib/db/quotes";

const reorderSchema = z.array(
  z.object({ id: z.string(), orderIndex: z.number().int() })
).max(200);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id: quoteId } = await params;
  const guard = await checkQuoteEditable(quoteId, session.user.role);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await req.json().catch(() => []);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

  for (const { id, orderIndex } of parsed.data) {
    await db.update(quoteSections).set({ orderIndex }).where(eq(quoteSections.id, id));
  }

  return NextResponse.json({ ok: true });
}
