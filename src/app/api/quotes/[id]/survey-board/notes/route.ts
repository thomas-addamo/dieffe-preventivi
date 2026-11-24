import { NextRequest, NextResponse } from "next/server";
import { addSurveyNote } from "@/lib/sites/survey-board";
import { requireBoard } from "../auth";

/** Nuova annotazione { body }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBoard((await params).id, true);
  if ("error" in auth) return auth.error;
  const res = await addSurveyNote(auth.quote, await req.json().catch(() => null), auth.session.user);
  return res.ok ? NextResponse.json(res.data, { status: 201 }) : NextResponse.json({ error: res.error }, { status: res.status });
}
