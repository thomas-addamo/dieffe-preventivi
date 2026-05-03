import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { quoteTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await params;
  await db.delete(quoteTemplates).where(eq(quoteTemplates.id, id));
  return NextResponse.json({ ok: true });
}
