import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;

  // Prevent deleting own session
  if (id === session.session.id) {
    return NextResponse.json({ error: "Non puoi terminare la tua sessione corrente" }, { status: 400 });
  }

  await db.delete(sessions).where(eq(sessions.id, id));
  return NextResponse.json({ ok: true });
}
