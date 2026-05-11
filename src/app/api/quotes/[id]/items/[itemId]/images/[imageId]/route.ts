import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quoteItemImages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";
import { logger } from "@/lib/logger";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; imageId: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { imageId } = await params;

  const [image] = await db
    .select()
    .from(quoteItemImages)
    .where(eq(quoteItemImages.id, imageId))
    .limit(1);

  if (image) {
    await db.delete(quoteItemImages).where(eq(quoteItemImages.id, imageId));
    deleteCloudinaryAsset(image.cloudinaryPublicId).catch((e) =>
      logger.warn({ err: e, imageId }, "cloudinary delete failed")
    );
    logger.info({ imageId, cloudinaryPublicId: image.cloudinaryPublicId }, "image deleted");
  }

  return NextResponse.json({ ok: true });
}
