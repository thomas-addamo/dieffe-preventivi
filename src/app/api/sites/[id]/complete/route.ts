import { NextRequest, NextResponse } from "next/server";
import { requireSite } from "@/lib/sites/guard";
import { completeSite } from "@/lib/sites/complete";

/**
 * Lavori conclusi: elimina il cantiere con tutti i suoi dati (fasi, SAL,
 * eventi, note). I preventivi restano, segnati come "lavori conclusi".
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSite(id, true);
  if ("error" in auth) return auth.error;
  const ok = await completeSite(id, auth.session.user.id);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Cantiere non trovato" }, { status: 404 });
}
