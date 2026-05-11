import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quoteSections, quoteItems, quoteItemImages } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";
import { logger } from "@/lib/logger";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { sectionId } = await params;

  const items = await db
    .select({ id: quoteItems.id })
    .from(quoteItems)
    .where(eq(quoteItems.sectionId, sectionId));

  let images: { id: string; cloudinaryPublicId: string }[] = [];
  if (items.length > 0) {
    images = await db
      .select({ id: quoteItemImages.id, cloudinaryPublicId: quoteItemImages.cloudinaryPublicId })
      .from(quoteItemImages)
      .where(inArray(quoteItemImages.itemId, items.map((i) => i.id)));
  }

  // CASCADE in schema handles items → images in DB
  await db.delete(quoteSections).where(eq(quoteSections.id, sectionId));

  for (const img of images) {
    deleteCloudinaryAsset(img.cloudinaryPublicId).catch((e) =>
      logger.warn({ err: e, imageId: img.id }, "cloudinary delete failed")
    );
  }

  logger.info({ sectionId, itemCount: items.length, imageCount: images.length }, "section deleted");
  return NextResponse.json({ ok: true });
}
