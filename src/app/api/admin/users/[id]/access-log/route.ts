import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { userAccessLog } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;
  const logs = await db
    .select()
    .from(userAccessLog)
    .where(eq(userAccessLog.userId, id))
    .orderBy(desc(userAccessLog.loginAt))
    .limit(20);

  return NextResponse.json(logs);
}
