import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users, sessions, auditLog } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getCurrentUser, verifyPassword, hashPassword } from "@/lib/auth";
import { passwordSchema } from "@/lib/password-policy";
import { generateId } from "@/lib/utils";

const schema = z.object({
  currentPassword: z.string().min(1, "Inserisci la password attuale"),
  newPassword: passwordSchema,
});

// Rate limiter in-memory: difesa contro il brute force della password attuale
// (richiede comunque una sessione valida → rischio già basso).
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const now = Date.now();
  const entry = attempts.get(session.user.id);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Troppi tentativi. Riprova più tardi." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi" },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  const valid = await verifyPassword(session.user.passwordHash, currentPassword);
  if (!valid) {
    // Conta solo i tentativi con password attuale errata.
    if (entry && entry.resetAt > now) entry.count++;
    else attempts.set(session.user.id, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.json({ error: "Password attuale non corretta" }, { status: 401 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "La nuova password deve essere diversa da quella attuale" },
      { status: 400 }
    );
  }

  attempts.delete(session.user.id);

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

  // Traccia l'evento di sicurezza (nessun dato sensibile nel log).
  await db
    .insert(auditLog)
    .values({
      id: generateId(),
      userId: session.user.id,
      action: "user.password_changed",
      entityType: "user",
      entityId: session.user.id,
      changes: { self: true },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
