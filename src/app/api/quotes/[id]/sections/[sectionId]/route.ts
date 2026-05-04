import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quoteSections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer") return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const { sectionId } = await params;
  // CASCADE defined in schema: items → section → quoteItemImages → quoteItems
  await db.delete(quoteSections).where(eq(quoteSections.id, sectionId));
  return NextResponse.json({ ok: true });
}
