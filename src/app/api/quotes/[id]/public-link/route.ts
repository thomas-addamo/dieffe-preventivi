import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { generatePublicToken, computeExpiresAt } from "@/lib/public-token";
import { env } from "@/lib/env";

const bodySchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer")
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;

  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!quote) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

  const { days } = parsed.data;
  const token = generatePublicToken();
  const expiresAt = computeExpiresAt(days);

  await db
    .update(quotes)
    .set({ publicToken: token, publicTokenExpiresAt: expiresAt, publicTokenDays: days })
    .where(eq(quotes.id, id));

  return NextResponse.json({
    token,
    expiresAt: expiresAt.toISOString(),
    url: `${env.APP_URL}/p/${token}`,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer")
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;

  await db
    .update(quotes)
    .set({ publicToken: null, publicTokenExpiresAt: null })
    .where(eq(quotes.id, id));

  return NextResponse.json({ ok: true });
}
