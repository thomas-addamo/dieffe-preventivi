import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { updateQuoteField } from "@/lib/db/quotes";

const schema = z.object({
  status: z.enum(["draft", "sent", "accepted", "rejected", "archived"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Stato non valido" }, { status: 400 });

  const extra: Record<string, string | null> = {};
  if (parsed.data.status === "sent") extra.sentAt = new Date().toISOString();

  await updateQuoteField(id, { status: parsed.data.status, ...extra } as never);
  return NextResponse.json({ ok: true });
}
