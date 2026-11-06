import { NextRequest, NextResponse } from "next/server";
import { requireSite } from "@/lib/sites/guard";
import { getSiteDetail } from "@/lib/sites/queries";
import { generateSiteInsights, needsInsights } from "@/lib/sites/insights";

export const maxDuration = 45;

/**
 * Consigli IA del cantiere. Senza `force` si rigenerano solo se i dati sono
 * cambiati (altrimenti si restituiscono quelli salvati): aprire la pagina non
 * consuma chiamate IA.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSite(id);
  if ("error" in auth) return auth.error;

  const { force } = (await req.json().catch(() => ({}))) as { force?: boolean };
  const detail = await getSiteDetail(id);
  if (!detail) return NextResponse.json({ error: "Cantiere non trovato" }, { status: 404 });

  if (!needsInsights(detail, !!force)) {
    return NextResponse.json({ insights: detail.site.aiInsights ?? null, cached: true });
  }
  const insights = await generateSiteInsights(detail);
  return NextResponse.json({ insights: insights ?? detail.site.aiInsights ?? null, cached: !insights });
}
