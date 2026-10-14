import { NextRequest, NextResponse } from "next/server";
import { requireSite } from "@/lib/sites/guard";
import { deleteEntity, ENTITIES, updateEntity, type Entity } from "@/lib/sites/entities";

type Ctx = { params: Promise<{ id: string; entity: string; itemId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, entity, itemId } = await params;
  if (!ENTITIES.includes(entity as Entity)) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  const auth = await requireSite(id, true);
  if ("error" in auth) return auth.error;

  const res = await updateEntity(id, entity as Entity, itemId, await req.json().catch(() => null));
  return res.ok ? NextResponse.json(res.data ?? { ok: true }) : NextResponse.json({ error: res.error }, { status: res.status });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, entity, itemId } = await params;
  if (!ENTITIES.includes(entity as Entity)) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  const auth = await requireSite(id, true);
  if ("error" in auth) return auth.error;

  const res = await deleteEntity(id, entity as Entity, itemId, auth.session.user);
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: res.status });
}
