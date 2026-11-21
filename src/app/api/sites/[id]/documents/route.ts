import { NextRequest, NextResponse } from "next/server";
import { requireSite } from "@/lib/sites/guard";
import { addSiteDocument } from "@/lib/sites/documents";

/** Registra un PDF caricato con la firma di /documents/sign: `{ publicId, name }`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSite(id, true);
  if ("error" in auth) return auth.error;
  const res = await addSiteDocument(id, await req.json().catch(() => null), auth.session.user.id);
  return res.ok ? NextResponse.json(res.data, { status: 201 }) : NextResponse.json({ error: res.error }, { status: res.status });
}
