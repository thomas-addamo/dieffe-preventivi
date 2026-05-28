import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quotes, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { deleteCloudinaryFolder } from "@/lib/cloudinary";
import { generateId } from "@/lib/utils";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { id } = await params;

  await deleteCloudinaryFolder(`dieffe-preventivi/${id}`).catch(() => {});

  await db.insert(auditLog).values({
    id: generateId(),
    userId: session.user.id,
    action: "quote.permanently_deleted",
    entityType: "quote",
    entityId: id,
    changes: { deletedAt: new Date().toISOString() },
  });

  await db.delete(quotes).where(eq(quotes.id, id));

  return NextResponse.json({ ok: true });
}
