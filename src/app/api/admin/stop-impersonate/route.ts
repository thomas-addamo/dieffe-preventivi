import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, getSessionUser, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (!session.session.isImpersonated) return NextResponse.json({ error: "Non in modalità impersonificazione" }, { status: 400 });

  // Delete the impersonated session
  await db.delete(sessions).where(eq(sessions.id, session.session.id));

  // Restore admin session
  const cookieStore = await cookies();
  const adminToken = cookieStore.get("dieffe_admin_token")?.value;

  const res = NextResponse.json({ ok: true });
  res.cookies.delete("dieffe_admin_token");

  if (adminToken) {
    const adminSession = await getSessionUser(adminToken);
    if (adminSession) {
      res.cookies.set(SESSION_COOKIE, adminToken, sessionCookieOptions());
    }
  }

  return res;
}
