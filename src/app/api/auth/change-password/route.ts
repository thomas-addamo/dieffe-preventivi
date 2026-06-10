import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users, sessions } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getCurrentUser, verifyPassword, hashPassword } from "@/lib/auth";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Minimo 8 caratteri"),
});

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  const valid = await verifyPassword(session.user.passwordHash, currentPassword);
  if (!valid) {
    return NextResponse.json({ error: "Password attuale non corretta" }, { status: 401 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "La nuova password deve essere diversa da quella attuale" },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
    })
    .where(eq(users.id, session.user.id));

  // Revoca tutte le altre sessioni dell'utente: dopo un cambio password le
  // sessioni aperte altrove non devono restare valide.
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, session.user.id), ne(sessions.id, session.session.id)));

  return NextResponse.json({ ok: true });
}
