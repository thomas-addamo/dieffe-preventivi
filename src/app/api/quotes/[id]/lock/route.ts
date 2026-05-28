import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quotes, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;
  await db.update(quotes)
    .set({ isLocked: true, lockedBy: session.user.id, lockedAt: new Date() })
    .where(eq(quotes.id, id));

  await db.insert(auditLog).values({
    id: generateId(),
    userId: session.user.id,
    action: "quote.locked",
    entityType: "quote",
    entityId: id,
    changes: { lockedAt: new Date().toISOString() },
  });

  return NextResponse.json({ ok: true });
}
