import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, clients, quoteItemImages, quoteItems, quoteSections, quotes } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateQuoteCode } from "@/lib/db/quotes";
import { cloudinary } from "@/lib/cloudinary";
import { generateId } from "@/lib/utils";

export const maxDuration = 60;

// Duplica un preventivo: stesse intestazioni, sezioni, voci e foto, con un
// nuovo codice e come bozza. Il cliente resta lo stesso oppure si cambia.
// Non si copiano stato, firme, link pubblico, blocco e cantiere: la copia è
// un preventivo nuovo a tutti gli effetti. Un lavoro extra duplicato diventa
// un preventivo autonomo.

const bodySchema = z.object({
  /** undefined = stesso cliente; null = nessun cliente; id = altro cliente. */
  clientId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(300).optional(),
  /** undefined = automatico (stesso cantiere, o indirizzo del nuovo cliente). */
  projectAddress: z.string().trim().max(500).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer")
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  const input = parsed.data;

  const { id } = await params;
  const [source] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!source || source.deletedAt)
    return NextResponse.json({ error: "Preventivo non trovato" }, { status: 404 });

  // Cliente: lo stesso, nessuno, oppure un altro (che deve esistere).
  const changeClient = input.clientId !== undefined && input.clientId !== source.clientId;
  let clientId = source.clientId;
  let projectAddress = source.projectAddress;
  if (changeClient) {
    clientId = input.clientId ?? null;
    projectAddress = null;
    if (clientId) {
      const [client] = await db
        .select({ id: clients.id, address: clients.address })
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      if (!client) return NextResponse.json({ error: "Cliente non trovato" }, { status: 400 });
      projectAddress = client.address;
    }
  }
  if (input.projectAddress !== undefined) projectAddress = input.projectAddress || null;

  const sections = await db
    .select()
    .from(quoteSections)
    .where(eq(quoteSections.quoteId, id))
    .orderBy(asc(quoteSections.orderIndex));
  const items = sections.length
    ? await db
        .select()
        .from(quoteItems)
        .where(inArray(quoteItems.sectionId, sections.map((s) => s.id)))
        .orderBy(asc(quoteItems.orderIndex))
    : [];
  const images = items.length
    ? await db
        .select()
        .from(quoteItemImages)
        .where(inArray(quoteItemImages.itemId, items.map((i) => i.id)))
        .orderBy(asc(quoteItemImages.orderIndex))
    : [];

  const newId = generateId();
  const code = await generateQuoteCode();

  const sectionIds = new Map(sections.map((s) => [s.id, generateId()]));
  const itemIds = new Map(items.map((i) => [i.id, generateId()]));

  // Intestazione, sezioni e voci in un'unica transazione.
  await db.batch([
    db.insert(quotes).values({
      id: newId,
      code,
      title: input.title ?? `${source.title} (copia)`,
      clientId,
      userId: session.user.id,
      status: "draft",
      kind: "standard",
      projectAddress,
      vatRate: source.vatRate,
      discountType: source.discountType,
      discountValue: source.discountValue,
      notes: source.notes,
      paymentTerms: source.paymentTerms,
      validUntil: null,
      publicTokenDays: source.publicTokenDays,
    }),
    ...(sections.length
      ? [
          db.insert(quoteSections).values(
            sections.map((s) => ({
              id: sectionIds.get(s.id)!,
              quoteId: newId,
              code: s.code,
              title: s.title,
              description: s.description,
              orderIndex: s.orderIndex,
              sectionNote: s.sectionNote,
              isOptional: s.isOptional,
              isOptionalIncluded: s.isOptionalIncluded,
              lumpSum: s.lumpSum,
              lumpSumPrice: s.lumpSumPrice,
            }))
          ),
        ]
      : []),
    ...(items.length
      ? [
          db.insert(quoteItems).values(
            items.map((i) => ({
              id: itemIds.get(i.id)!,
              sectionId: sectionIds.get(i.sectionId)!,
              description: i.description,
              unitOfMeasure: i.unitOfMeasure,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
              total: i.total,
              notes: i.notes,
              orderIndex: i.orderIndex,
            }))
          ),
        ]
      : []),
    db.insert(auditLog).values({
      id: generateId(),
      userId: session.user.id,
      action: "quote.duplicated",
      entityType: "quote",
      entityId: newId,
      changes: { from: source.code, clientChanged: changeClient },
    }),
  ]);

  // Foto: copiate su Cloudinary nella cartella del nuovo preventivo, così
  // eliminare l'originale non le cancella. Se una copia non riesce, la voce
  // resta senza quella foto (il preventivo è comunque creato).
  let photosSkipped = 0;
  if (images.length) {
    const copies = await Promise.all(
      images.map(async (img) => {
        const itemId = itemIds.get(img.itemId)!;
        try {
          const up = await cloudinary.uploader.upload(img.cloudinaryUrl, {
            folder: `dieffe-preventivi/${newId}/${itemId}`,
            public_id: generateId(8),
            resource_type: "image",
          });
          return {
            id: generateId(),
            itemId,
            cloudinaryPublicId: up.public_id,
            cloudinaryUrl: up.secure_url,
            caption: img.caption,
            orderIndex: img.orderIndex,
          };
        } catch {
          photosSkipped++;
          return null;
        }
      })
    );
    const rows = copies.filter((c) => c !== null);
    if (rows.length) await db.insert(quoteItemImages).values(rows);
  }

  return NextResponse.json({ id: newId, code, photosSkipped }, { status: 201 });
}
