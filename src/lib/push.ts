import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema";
import { inArray, eq } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Web Push nativo: invia notifiche al service worker dei dispositivi iscritti.
// Le chiavi VAPID vanno definite nelle env (vedi .env.local / Vercel).
// ─────────────────────────────────────────────────────────────────────────────

const PUBLIC = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:impresa.dieffe@gmail.com";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC || !PRIVATE) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body?: string | null;
  url?: string | null;
  tag?: string;
}

/**
 * Invia una push a tutti i dispositivi iscritti degli utenti indicati.
 * Non lancia mai: un fallimento push non deve rompere l'operazione principale.
 * Le subscription scadute (404/410) vengono rimosse automaticamente.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;
  if (!ensureConfigured()) {
    console.warn("[push] VAPID non configurato: salto invio push");
    return;
  }

  let subs;
  try {
    subs = await db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, unique));
  } catch (err) {
    console.error("[push] lettura subscription fallita:", err);
    return;
  }
  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "/dashboard",
    tag: payload.tag,
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body
        );
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        // Subscription non più valida: rimuovila.
        if (status === 404 || status === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, s.endpoint))
            .catch(() => {});
        } else {
          console.error("[push] invio fallito:", status ?? err);
        }
      }
    })
  );
}
