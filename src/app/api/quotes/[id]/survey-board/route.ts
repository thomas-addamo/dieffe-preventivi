import { NextRequest, NextResponse } from "next/server";
import { getSurveyBoard, setLogistics } from "@/lib/sites/survey-board";
import { requireBoard } from "./auth";

// Pannello «Sopralluogo» del preventivo: annotazioni, foto e logistica di cantiere.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBoard((await params).id, false);
  if ("error" in auth) return auth.error;
  return NextResponse.json(await getSurveyBoard(auth.quote));
}

/** { logistics: 1 | 2 | 3 | 4 | null } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBoard((await params).id, true);
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as { logistics?: unknown } | null;
  if (!body || !("logistics" in body)) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  const res = await setLogistics(auth.quote, body.logistics, auth.session.user);
  return res.ok ? NextResponse.json(res.data) : NextResponse.json({ error: res.error }, { status: res.status });
}
