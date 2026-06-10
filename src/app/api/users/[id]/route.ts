import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users, sessions } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getCurrentUser, hashPassword } from "@/lib/auth";

const patchSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  disabled: z.boolean().optional(),
  password: z.string().min(8).optional(),
  name: z.string().min(2).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

  // Un admin non può auto-disattivarsi o auto-declassarsi: rischierebbe di
  // lasciare il sistema senza amministratori.
  if (id === session.user.id) {
    if (parsed.data.disabled === true) {
      return NextResponse.json({ error: "Non puoi disattivare il tuo account" }, { status: 400 });
    }
    if (parsed.data.role && parsed.data.role !== "admin") {
      return NextResponse.json({ error: "Non puoi rimuovere il tuo ruolo admin" }, { status: 400 });
    }
  }

  const update: Partial<typeof users.$inferInsert> = {};
  if (parsed.data.role !== undefined) update.role = parsed.data.role;
  if (parsed.data.disabled !== undefined) update.disabled = parsed.data.disabled;
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.password) {
    update.passwordHash = await hashPassword(parsed.data.password);
    update.mustChangePassword = true;
  }

  await db.update(users).set(update).where(eq(users.id, id));

  // Revoca le sessioni esistenti se l'utente è stato disattivato o se la
  // password è stata reimpostata (eccetto la sessione corrente dell'admin).
  if (parsed.data.disabled === true || parsed.data.password) {
    await db
      .delete(sessions)
      .where(and(eq(sessions.userId, id), ne(sessions.id, session.session.id)));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUser();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "Non puoi eliminare il tuo account" }, { status: 400 });
  }

  await db.delete(users).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
