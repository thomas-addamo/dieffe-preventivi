import { NextRequest, NextResponse } from "next/server";
import { requireSite } from "@/lib/sites/guard";
import { deleteSiteDocument, renameSiteDocument } from "@/lib/sites/documents";

type Ctx = { params: Promise<{ id: string; docId: string }> };

/** Rinomina: `{ name }`. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, docId } = await params;
  const auth = await requireSite(id, true);
  if ("error" in auth) return auth.error;
  const res = await renameSiteDocument(id, docId, await req.json().catch(() => null));
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: res.status });
}

/** Elimina (chi l'ha caricato o un admin). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, docId } = await params;
  const auth = await requireSite(id, true);
  if ("error" in auth) return auth.error;
  const res = await deleteSiteDocument(id, docId, auth.session.user);
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: res.status });
}
