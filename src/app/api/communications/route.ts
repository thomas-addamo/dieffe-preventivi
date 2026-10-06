import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { communications } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { communicationInputSchema } from "@/lib/communications";
import { desc, like } from "drizzle-orm";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const rows = await db.select().from(communications).orderBy(desc(communications.createdAt));
  return NextResponse.json(rows);
}

/** Prossimo protocollo dell'anno: COM-2026-001, COM-2026-002… */
async function nextCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `COM-${year}-`;
  const rows = await db
    .select({ code: communications.code })
    .from(communications)
    .where(like(communications.code, `${prefix}%`));
  const max = rows.reduce((m, r) => Math.max(m, Number(r.code.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  if (session.user.role === "viewer")
    return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = communicationInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

  const id = generateId();
  // Il codice è univoco: in caso di salvataggi simultanei si riprova.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [row] = await db
        .insert(communications)
        .values({
          id,
          code: await nextCode(),
          ...parsed.data,
          userId: session.user.id,
        })
        .returning();
      return NextResponse.json(row, { status: 201 });
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
}
