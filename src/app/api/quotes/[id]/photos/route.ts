import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import { addQuotePhoto, listQuotePhotos } from "@/lib/sites/photos";

export const maxDuration = 30;

// Foto del sopralluogo di un preventivo (D1).

async function loadQuote(id: string) {
  const [q] = await db.select({ id: quotes.id, siteId: quotes.siteId, deletedAt: quotes.deletedAt }).from(quotes).where(eq(quotes.id, id)).limit(1);
  return q && !q.deletedAt ? q : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await params;
  if (!(await loadQuote(id))) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  return NextResponse.json({ photos: await listQuotePhotos(id) });
}

/** Nuova foto (multipart: file, caption?). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });
  const { id } = await params;
  const quote = await loadQuote(id);
  if (!quote) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  try {
    const res = await addQuotePhoto(id, quote.siteId, form, session.user.id);
    return res.ok ? NextResponse.json(res.data, { status: 201 }) : NextResponse.json({ error: res.error }, { status: res.status });
  } catch (err) {
    console.error("[sopralluogo] caricamento foto fallito:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Caricamento non riuscito, riprova" }, { status: 502 });
  }
}
