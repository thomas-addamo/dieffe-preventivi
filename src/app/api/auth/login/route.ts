import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  verifyPassword,
  createSession,
  SESSION_COOKIE,
} from "@/lib/auth";

// simple in-memory rate limiter: ip -> { count, resetAt }
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();

  // rate limiting
  const attempt = loginAttempts.get(ip);
  if (attempt && attempt.resetAt > now && attempt.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Troppi tentativi. Riprova tra 15 minuti." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi" },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  const isValid = user && !user.disabled
    ? await verifyPassword(user.passwordHash, password)
    : false;

  if (!isValid) {
    if (attempt && attempt.resetAt > now) {
      attempt.count++;
    } else {
      loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    }
    return NextResponse.json(
      { error: "Email o password non corretti" },
      { status: 401 }
    );
  }

  loginAttempts.delete(ip);

  // update lastLoginAt
  await db
    .update(users)
    .set({ lastLoginAt: new Date().toISOString() })
    .where(eq(users.id, user.id));

  const token = await createSession(
    user.id,
    ip,
    req.headers.get("user-agent") ?? undefined
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return res;
}
