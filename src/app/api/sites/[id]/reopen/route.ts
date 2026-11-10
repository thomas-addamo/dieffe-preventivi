import { NextRequest, NextResponse } from "next/server";
import { requireSite } from "@/lib/sites/guard";
import { reopenSite } from "@/lib/sites/complete";

/** Riporta in corso un cantiere concluso (dall'archivio). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSite(id, true, { allowArchived: true });
  if ("error" in auth) return auth.error;
  const res = await reopenSite(id, auth.session.user.id);
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: 409 });
}
