import { db } from "@/lib/db/client";
import { notifications, users, companySettings, type NewNotification } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { sendPushToUsers } from "@/lib/push";

type NotificationType = NewNotification["type"];

interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

/** Crea una notifica per un singolo utente. Non lancia mai: una notifica
 *  fallita non deve far fallire l'operazione principale. */
export async function notifyUser(userId: string, input: NotifyInput) {
  try {
    await db.insert(notifications).values({
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
  } catch (err) {
    console.error("[notifications] insert failed:", err instanceof Error ? err.message : err);
  }
  // Push nativa (best-effort, non blocca in caso di errore).
  await sendPushToUsers([userId], {
    title: input.title,
    body: input.body,
    url: input.link,
    tag: input.type,
  });
}

/** Crea la stessa notifica per più utenti (deduplicati). */
export async function notifyUsers(userIds: string[], input: NotifyInput) {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;
  try {
    await db.insert(notifications).values(
      unique.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      }))
    );
  } catch (err) {
    console.error("[notifications] bulk insert failed:", err instanceof Error ? err.message : err);
  }
  // Push nativa a tutti i destinatari (best-effort).
  await sendPushToUsers(unique, {
    title: input.title,
    body: input.body,
    url: input.link,
    tag: input.type,
  });
}

/** Notifica tutti gli utenti attivi. Ritorna il numero di destinatari. */
export async function notifyAllUsers(input: NotifyInput): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.disabled, false));
  await notifyUsers(rows.map((r) => r.id), input);
  return rows.length;
}

/** Notifica tutti gli admin attivi (escludendo facoltativamente un utente,
 *  tipicamente chi ha compiuto l'azione). */
export async function notifyAdmins(input: NotifyInput, excludeUserId?: string) {
  try {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.role, "admin"),
          eq(users.disabled, false),
          ...(excludeUserId ? [ne(users.id, excludeUserId)] : [])
        )
      );
    await notifyUsers(admins.map((a) => a.id), input);
  } catch (err) {
    console.error("[notifications] notifyAdmins failed:", err instanceof Error ? err.message : err);
  }
}

// ─── Eventi di dominio ────────────────────────────────────────────────────────

/** Il cliente ha firmato (accettato/rifiutato) un preventivo dal link pubblico. */
export async function notifyQuoteSigned(opts: {
  quoteId: string;
  quoteCode: string;
  quoteTitle: string;
  ownerUserId: string;
  signerName: string;
  action: "accepted" | "rejected";
}) {
  const accepted = opts.action === "accepted";
  const input: NotifyInput = {
    type: accepted ? "quote_signed" : "quote_rejected",
    title: accepted
      ? `Preventivo ${opts.quoteCode} accettato ✅`
      : `Preventivo ${opts.quoteCode} rifiutato`,
    body: `${opts.signerName} ha ${accepted ? "accettato e firmato" : "rifiutato"} "${opts.quoteTitle}".`,
    link: `/preventivi/${opts.quoteId}`,
  };

  // L'admin decide se notificare TUTTO il team (in-app + push nativa) oppure
  // solo il titolare del preventivo + gli admin.
  let broadcast = accepted; // default storico: broadcast all'accettazione
  try {
    const [settings] = await db
      .select({
        onAccept: companySettings.notifyTeamOnAccept,
        onReject: companySettings.notifyTeamOnReject,
      })
      .from(companySettings)
      .limit(1);
    if (settings) broadcast = accepted ? settings.onAccept : settings.onReject;
  } catch {
    /* in caso di errore usa il default */
  }

  if (broadcast) {
    // Tutti gli utenti attivi ricevono notifica in-app + push nativa.
    await notifyAllUsers(input);
  } else {
    // Titolare del preventivo + admin (senza duplicare se coincidono).
    await notifyUser(opts.ownerUserId, input);
    await notifyAdmins(input, opts.ownerUserId);
  }
}

/** Cambio stato fatto da un altro utente. */
export async function notifyQuoteStatusChanged(opts: {
  quoteId: string;
  quoteCode: string;
  ownerUserId: string;
  actorUserId: string;
  actorName: string;
  newStatusLabel: string;
}) {
  if (opts.ownerUserId === opts.actorUserId) return;
  await notifyUser(opts.ownerUserId, {
    type: "quote_status",
    title: `Preventivo ${opts.quoteCode}: stato aggiornato`,
    body: `${opts.actorName} ha impostato lo stato su "${opts.newStatusLabel}".`,
    link: `/preventivi/${opts.quoteId}`,
  });
}

/** Preventivo riassegnato a un nuovo titolare. */
export async function notifyQuoteAssigned(opts: {
  quoteId: string;
  quoteCode: string;
  quoteTitle: string;
  newOwnerUserId: string;
  actorUserId: string;
  actorName: string;
}) {
  if (opts.newOwnerUserId === opts.actorUserId) return;
  await notifyUser(opts.newOwnerUserId, {
    type: "quote_assigned",
    title: `Ti è stato assegnato il preventivo ${opts.quoteCode}`,
    body: `${opts.actorName} ti ha assegnato "${opts.quoteTitle}".`,
    link: `/preventivi/${opts.quoteId}`,
  });
}

/** Lock/unlock di un preventivo da parte di un admin. */
export async function notifyQuoteLockChanged(opts: {
  quoteId: string;
  quoteCode: string;
  ownerUserId: string;
  actorUserId: string;
  actorName: string;
  locked: boolean;
}) {
  if (opts.ownerUserId === opts.actorUserId) return;
  await notifyUser(opts.ownerUserId, {
    type: opts.locked ? "quote_locked" : "quote_unlocked",
    title: `Preventivo ${opts.quoteCode} ${opts.locked ? "bloccato 🔒" : "sbloccato 🔓"}`,
    body: `${opts.actorName} ha ${opts.locked ? "bloccato" : "sbloccato"} il preventivo.`,
    link: `/preventivi/${opts.quoteId}`,
  });
}

/** Preventivo spostato nel cestino da un altro utente. */
export async function notifyQuoteDeleted(opts: {
  quoteCode: string;
  quoteTitle: string;
  ownerUserId: string;
  actorUserId: string;
  actorName: string;
}) {
  if (opts.ownerUserId === opts.actorUserId) return;
  await notifyUser(opts.ownerUserId, {
    type: "quote_deleted",
    title: `Preventivo ${opts.quoteCode} spostato nel cestino`,
    body: `${opts.actorName} ha spostato "${opts.quoteTitle}" nel cestino.`,
    link: "/cestino",
  });
}
