import { db } from "@/lib/db/client";
import { users, sessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import argon2 from "argon2";
import { generateId } from "@/lib/utils";
import { cookies } from "next/headers";

const SESSION_COOKIE = "dieffe_session";
const SESSION_DURATION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const token = generateId(32);
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await db.insert(sessions).values({
    id: generateId(),
    userId,
    token,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return token;
}

export async function getSessionUser(token: string) {
  const result = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), sql`${sessions.expiresAt} > now()`))
    .limit(1);

  return result[0] ?? null;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionUser(token);
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export { SESSION_COOKIE };
