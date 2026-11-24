import { NextRequest, NextResponse } from "next/server";
import { deleteSurveyNote, updateSurveyNote } from "@/lib/sites/survey-board";
import { requireBoard } from "../../auth";

type Params = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, noteId } = await params;
  const auth = await requireBoard(id, true);
  if ("error" in auth) return auth.error;
  const res = await updateSurveyNote(auth.quote, noteId, await req.json().catch(() => null), auth.session.user);
  return res.ok ? NextResponse.json(res.data) : NextResponse.json({ error: res.error }, { status: res.status });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, noteId } = await params;
  const auth = await requireBoard(id, true);
  if ("error" in auth) return auth.error;
  const res = await deleteSurveyNote(auth.quote, noteId, auth.session.user);
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: res.status });
}
