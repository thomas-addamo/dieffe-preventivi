import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quoteItems, quoteItemImages, quoteSections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { checkQuoteEditable } from "@/lib/db/quotes";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";
import { logger } from "@/lib/logger";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id: quoteId, itemId } = await params;
  const guard = await checkQuoteEditable(quoteId, session.user.role);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  // La voce deve appartenere al preventivo indicato nell'URL.
  const [owned] = await db
    .select({ id: quoteItems.id, quoteId: quoteSections.quoteId })
    .from(quoteItems)
    .innerJoin(quoteSections, eq(quoteItems.sectionId, quoteSections.id))
    .where(eq(quoteItems.id, itemId))
    .limit(1);
  if (!owned || owned.quoteId !== quoteId) {
    return NextResponse.json({ error: "Voce non trovata" }, { status: 404 });
  }

  const images = await db
    .select()
    .from(quoteItemImages)
    .where(eq(quoteItemImages.itemId, itemId));

  await db.delete(quoteItems).where(eq(quoteItems.id, itemId));

  for (const img of images) {
    deleteCloudinaryAsset(img.cloudinaryPublicId).catch((e) =>
      logger.warn({ err: e, imageId: img.id }, "cloudinary delete failed")
    );
  }

  logger.info({ itemId, imageCount: images.length }, "item deleted");
  return NextResponse.json({ ok: true });
}
