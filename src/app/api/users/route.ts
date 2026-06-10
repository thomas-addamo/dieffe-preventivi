import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { desc } from "drizzle-orm";
import { passwordSchema } from "@/lib/password-policy";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: passwordSchema,
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      disabled: users.disabled,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const id = generateId();

  await db.insert(users).values({
    id,
    email: parsed.data.email.toLowerCase(),
    passwordHash,
    name: parsed.data.name,
    role: parsed.data.role,
    mustChangePassword: true,
  });

  return NextResponse.json({ id }, { status: 201 });
}
