import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quoteTemplates } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { desc } from "drizzle-orm";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  data: z.object({ sections: z.array(z.any()) }),
});

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const rows = await db
    .select()
    .from(quoteTemplates)
    .orderBy(desc(quoteTemplates.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const id = generateId();
  await db.insert(quoteTemplates).values({
    id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    data: parsed.data.data as never,
    userId: session.user.id,
  });

  return NextResponse.json({ id }, { status: 201 });
}
