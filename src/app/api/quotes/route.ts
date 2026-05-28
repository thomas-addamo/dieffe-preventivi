import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quotes, clients, users } from "@/lib/db/schema";
import { eq, desc, like, and, or, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { createQuote } from "@/lib/db/quotes";

const createSchema = z.object({
  title: z.string().min(1, "Titolo obbligatorio"),
  clientId: z.string().nullable().optional(),
  projectAddress: z.string().nullable().optional(),
  vatRate: z.number().optional(),
  notes: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  const search = searchParams.get("search");

  const conditions = [isNull(quotes.deletedAt)];
  if (status) conditions.push(eq(quotes.status, status as never));
  if (clientId) conditions.push(eq(quotes.clientId, clientId));
  if (search)
    conditions.push(
      or(
        like(quotes.title, `%${search}%`),
        like(quotes.code, `%${search}%`)
      )!
    );

  const rows = await db
    .select({
      id: quotes.id,
      code: quotes.code,
      title: quotes.title,
      status: quotes.status,
      vatRate: quotes.vatRate,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
      clientName: clients.name,
      authorName: users.name,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .innerJoin(users, eq(quotes.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(quotes.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const id = await createQuote(session.user.id, parsed.data);
  return NextResponse.json({ id }, { status: 201 });
}
