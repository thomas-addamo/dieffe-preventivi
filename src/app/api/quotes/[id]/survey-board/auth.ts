import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadBoardQuote, type BoardQuote } from "@/lib/sites/survey-board";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Utente autenticato (chi scrive non può essere "viewer") e preventivo vivo. */
export async function requireBoard(id: string, write: boolean): Promise<{ session: Session; quote: BoardQuote } | { error: NextResponse }> {
  const session = await getCurrentUser();
  if (!session) return { error: NextResponse.json({ error: "Non autorizzato" }, { status: 401 }) };
  if (write && session.user.role === "viewer") return { error: NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 }) };
  const quote = await loadBoardQuote(id);
  if (!quote) return { error: NextResponse.json({ error: "Non trovato" }, { status: 404 }) };
  return { session, quote };
}
