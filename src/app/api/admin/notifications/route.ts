import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/permissions/guard";
import { notifyUser, notifyAllUsers } from "@/lib/notifications";
import { ADMIN_NOTIFICATION_TYPES } from "@/lib/notification-meta";

const schema = z.object({
  type: z.enum(ADMIN_NOTIFICATION_TYPES),
  title: z.string().trim().min(1, "Titolo obbligatorio").max(120),
  body: z.string().trim().max(500).optional().nullable(),
  // Link interno facoltativo (deve iniziare con "/").
  link: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || v.startsWith("/"), {
      message: "Il link deve essere un percorso interno (es. /dashboard)",
    })
    .optional()
    .nullable(),
  // "all" oppure l'id di un singolo utente.
  target: z.string().min(1),
});

// POST /api/admin/notifications — invia una notifica a tutti o a un utente.
export async function POST(req: NextRequest) {
  const { error } = await requireRole("admin");
  if (error) return error;

  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, title, body, link, target } = parsed.data;
  const input = {
    type,
    title,
    body: body || null,
    link: link || null,
  };

  if (target === "all") {
    const recipients = await notifyAllUsers(input);
    return NextResponse.json({ ok: true, recipients });
  }

  // Destinatario singolo: verifica che l'utente esista e sia attivo.
  const [recipient] = await db
    .select({ id: users.id, disabled: users.disabled })
    .from(users)
    .where(eq(users.id, target))
    .limit(1);

  if (!recipient || recipient.disabled) {
    return NextResponse.json(
      { error: "Destinatario non valido o disattivato" },
      { status: 400 }
    );
  }

  await notifyUser(recipient.id, input);
  return NextResponse.json({ ok: true, recipients: 1 });
}
