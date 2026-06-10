import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { hashPassword, createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { generateId } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const [{ value: existingCount }] = await db
    .select({ value: count() })
    .from(users);

  // only allow self-register when DB is empty (first run)
  if (existingCount > 0) {
    return NextResponse.json(
      { error: "Registrazione non consentita" },
      { status: 403 }
    );
  }

  const { name, email, password } = parsed.data;
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Email già registrata" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const userId = generateId();

  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    passwordHash,
    name,
    role: "admin",
    mustChangePassword: false,
  });

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const token = await createSession(
    userId,
    ip,
    req.headers.get("user-agent") ?? undefined
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
