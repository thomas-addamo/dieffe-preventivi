import { NextResponse } from "next/server";
import { requireSite } from "@/lib/sites/guard";
import { signDocumentUpload } from "@/lib/sites/documents";

/** Firma per caricare un PDF direttamente su Cloudinary (B3). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSite(id, true);
  if ("error" in auth) return auth.error;
  return NextResponse.json(signDocumentUpload(id));
}
