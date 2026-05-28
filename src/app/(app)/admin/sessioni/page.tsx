import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessioniClient } from "./SessioniClient";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export default async function SessioniPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const rows = await db
    .select({
      id: sessions.id,
      token: sessions.token,
      expiresAt: sessions.expiresAt,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      isImpersonated: sessions.isImpersonated,
      userName: users.name,
      userEmail: users.email,
      userId: users.id,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(sql`${sessions.expiresAt} > now()`)
    .orderBy(desc(sessions.createdAt));

  return <SessioniClient rows={rows} currentToken={session.session.token} />;
}
