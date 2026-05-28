import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { generateId } from "@/lib/utils";

const schema = z.object({ userId: z.string() });

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

  const { userId } = parsed.data;
  if (userId === session.user.id) return NextResponse.json({ error: "Non puoi impersonare te stesso" }, { status: 400 });

  const [targetUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!targetUser) return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  if (targetUser.role === "admin") return NextResponse.json({ error: "Non puoi impersonare un admin" }, { status: 403 });

  const token = generateId(32);
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 ore

  await db.insert(sessions).values({
    id: generateId(),
    userId: targetUser.id,
    token,
    expiresAt,
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
    isImpersonated: true,
    impersonatedBy: session.user.id,
  });

  const res = NextResponse.json({ ok: true });
  // Save current admin token in a separate cookie to restore later
  res.cookies.set("dieffe_admin_token", session.session.token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 4 * 60 * 60,
    path: "/",
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 4 * 60 * 60,
    path: "/",
  });
  return res;
}
