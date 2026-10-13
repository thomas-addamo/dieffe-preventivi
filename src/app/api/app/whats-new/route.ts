import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getChangelogFor, getWhatsNew } from "@/lib/changelog";

/**
 * "Novità" per l'app iPhone (ios/, WhatsNewView): la voce importante da
 * mostrare a chi usa `version` e ha visto le novità fino a `seen`.
 * `preview` restituisce una voce qualsiasi (solo per le prove dell'app).
 */
export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const preview = params.get("preview");
  if (preview) return NextResponse.json({ entry: getChangelogFor(preview) ?? null });

  const version = params.get("version");
  if (!version) return NextResponse.json({ error: "Versione mancante" }, { status: 400 });
  return NextResponse.json({ entry: getWhatsNew(version, params.get("seen")) ?? null });
}
