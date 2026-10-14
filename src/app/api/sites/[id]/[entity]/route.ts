import { NextRequest, NextResponse } from "next/server";
import { requireSite } from "@/lib/sites/guard";
import { createEntity, ENTITIES, type Entity } from "@/lib/sites/entities";

/** Nuova fase / SAL / evento / nota del cantiere. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; entity: string }> }) {
  const { id, entity } = await params;
  if (!ENTITIES.includes(entity as Entity)) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  const auth = await requireSite(id, true);
  if ("error" in auth) return auth.error;

  const res = await createEntity(id, entity as Entity, await req.json().catch(() => null), auth.session.user.id);
  return res.ok ? NextResponse.json(res.data ?? { ok: true }) : NextResponse.json({ error: res.error }, { status: res.status });
}
