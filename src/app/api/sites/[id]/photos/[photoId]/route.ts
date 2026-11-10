import { NextRequest, NextResponse } from "next/server";
import { requireSite } from "@/lib/sites/guard";
import { deleteSitePhoto, updateSitePhoto } from "@/lib/sites/photos";

type Ctx = { params: Promise<{ id: string; photoId: string }> };

/** Didascalia o fase della foto. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, photoId } = await params;
  const auth = await requireSite(id, true);
  if ("error" in auth) return auth.error;
  const res = await updateSitePhoto(id, photoId, await req.json().catch(() => null));
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: res.status });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, photoId } = await params;
  const auth = await requireSite(id, true);
  if ("error" in auth) return auth.error;
  const res = await deleteSitePhoto(id, photoId, auth.session.user);
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: res.status });
}
