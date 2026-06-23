import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quoteTemplates, quoteSections, quoteItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { createQuote } from "@/lib/db/quotes";
import { generateId } from "@/lib/utils";
import { calcItemTotal } from "@/lib/calculations";
import type { TemplateData } from "@/types";

// Crea un nuovo preventivo a partire da un template (sezioni + voci precompilate)
// e restituisce l'id del preventivo, così il client può aprirlo nell'editor.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer")
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;
  const [tpl] = await db
    .select()
    .from(quoteTemplates)
    .where(eq(quoteTemplates.id, id))
    .limit(1);
  if (!tpl) return NextResponse.json({ error: "Template non trovato" }, { status: 404 });

  const data = tpl.data as TemplateData;
  const quoteId = await createQuote(session.user.id, {
    title: tpl.name || "Nuovo preventivo",
  });

  const sections = data.sections ?? [];
  for (let si = 0; si < sections.length; si++) {
    const s = sections[si];
    const sectionId = generateId();
    await db.insert(quoteSections).values({
      id: sectionId,
      quoteId,
      code: s.code ?? "",
      title: s.title ?? "",
      description: s.description ?? null,
      orderIndex: si,
    });

    const items = s.items ?? [];
    for (let ii = 0; ii < items.length; ii++) {
      const it = items[ii];
      const quantity = it.quantity ?? 1;
      const unitPrice = it.unitPrice ?? 0;
      const discount = it.discount ?? 0;
      await db.insert(quoteItems).values({
        id: generateId(),
        sectionId,
        description: it.description ?? "",
        unitOfMeasure: it.unitOfMeasure ?? "n°",
        quantity,
        unitPrice,
        discount,
        total: calcItemTotal(quantity, unitPrice, discount),
        notes: it.notes ?? null,
        orderIndex: ii,
      });
    }
  }

  return NextResponse.json({ id: quoteId }, { status: 201 });
}
