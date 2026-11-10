import { NextRequest, NextResponse } from "next/server";
import { requireSite } from "@/lib/sites/guard";
import { addSitePhoto } from "@/lib/sites/photos";

export const maxDuration = 30;

/** Nuova foto di cantiere (multipart: file, caption?, phaseId?). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSite(id, true);
  if ("error" in auth) return auth.error;
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  try {
    const res = await addSitePhoto(id, form, auth.session.user.id);
    return res.ok ? NextResponse.json(res.data, { status: 201 }) : NextResponse.json({ error: res.error }, { status: res.status });
  } catch (err) {
    console.error("[sites] caricamento foto fallito:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Caricamento non riuscito, riprova" }, { status: 502 });
  }
}
