import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { siteDocuments } from "@/lib/db/schema";
import { requireSite } from "@/lib/sites/guard";
import { signedDocumentUrl } from "@/lib/sites/documents";

/**
 * Apre un documento PDF del cantiere (B3). L'account Cloudinary non consegna i
 * PDF dall'indirizzo pubblico ("deny or ACL failure"): si passa da un link di
 * download firmato e valido 15 minuti, rilasciato solo a chi vede il cantiere.
 *  • senza parametri → 302 al file (anteprima nel sito, "apri in una scheda");
 *  • `?json=1` → `{ url }` (app iPhone, che poi lo scarica e lo tiene in cache).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const auth = await requireSite(id);
  if ("error" in auth) return auth.error;
  const [doc] = await db
    .select({ publicId: siteDocuments.publicId })
    .from(siteDocuments)
    .where(and(eq(siteDocuments.id, docId), eq(siteDocuments.siteId, id)))
    .limit(1);
  if (!doc) return NextResponse.json({ error: "Documento non trovato" }, { status: 404 });
  const url = signedDocumentUrl(doc.publicId, req.nextUrl.searchParams.get("download") === "1");
  if (req.nextUrl.searchParams.get("json") === "1") return NextResponse.json({ url });
  return NextResponse.redirect(url, 302);
}
