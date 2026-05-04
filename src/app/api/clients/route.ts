import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { clients } from "@/lib/db/schema";
import { eq, like, or, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";

const clientSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  address: z.string().nullable().optional(),
  vatNumber: z.string().nullable().optional(),
  email: z.string().email("Email non valida").nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const search = new URL(req.url).searchParams.get("search");
  const rows = await db
    .select()
    .from(clients)
    .where(search ? or(like(clients.name, `%${search}%`), like(clients.email, `%${search}%`)) : undefined)
    .orderBy(desc(clients.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const id = generateId();
  await db.insert(clients).values({ id, ...parsed.data, email: parsed.data.email || null });
  const [created] = await db.select().from(clients).where(eq(clients.id, id));
  return NextResponse.json(created, { status: 201 });
}
