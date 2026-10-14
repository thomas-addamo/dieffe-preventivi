import { db } from "@/lib/db/client";
import { quoteSignatures } from "@/lib/db/schema";
import { storeSignatureImage } from "@/lib/cloudinary";
import { eq, like } from "drizzle-orm";

/**
 * Sposta su Cloudinary le firme ancora salvate come immagine base64 nel DB
 * (quelle precedenti alla 3.19.1) e lascia solo il link. Idempotente: tocca
 * solo le righe "data:" e aggiorna una riga solo se il caricamento è riuscito.
 */
export async function moveLegacySignatures(limit = 20): Promise<number> {
  const rows = await db
    .select({
      id: quoteSignatures.id,
      quoteId: quoteSignatures.quoteId,
      dataUrl: quoteSignatures.signatureDataUrl,
    })
    .from(quoteSignatures)
    .where(like(quoteSignatures.signatureDataUrl, "data:%"))
    .limit(limit);

  let moved = 0;
  for (const row of rows) {
    const url = await storeSignatureImage(row.dataUrl, row.quoteId);
    if (url.startsWith("data:")) continue;
    await db.update(quoteSignatures).set({ signatureDataUrl: url }).where(eq(quoteSignatures.id, row.id));
    moved++;
  }
  return moved;
}
