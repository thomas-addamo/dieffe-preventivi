import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// POST /api/push/subscribe — registra (o aggiorna) la subscription del device
export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session)
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;
  const userAgent = req.headers.get("user-agent")?.slice(0, 400) ?? null;

  // Upsert sull'endpoint univoco: se lo stesso device si re-iscrive (o cambia
  // utente sullo stesso browser) aggiorniamo proprietario e chiavi.
  await db
    .insert(pushSubscriptions)
    .values({
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: session.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
    });

  return NextResponse.json({ ok: true });
}

// DELETE /api/push/subscribe — rimuove la subscription (disattiva sul device)
export async function DELETE(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session)
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const endpoint = typeof json?.endpoint === "string" ? json.endpoint : null;
  if (!endpoint)
    return NextResponse.json({ error: "endpoint mancante" }, { status: 400 });

  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));

  return NextResponse.json({ ok: true });
}
