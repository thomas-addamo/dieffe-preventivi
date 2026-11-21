// ─────────────────────────────────────────────────────────────────────────────
// Blocco dei preventivi (B1). Funzione pura, usata da server, sito e (tramite
// GET /api/quotes/:id → `lock`) dall'app iPhone.
//
//  Stato del preventivo              Blocco       Chi sblocca
//  ───────────────────────────────── ──────────── ─────────────────────────────
//  bloccato a mano dall'admin        "admin"      solo admin
//  accettato + lavori conclusi       "completed"  solo admin (gli altri chiedono)
//  rifiutato                         "rejected"   solo admin (gli altri chiedono)
//  inviato                           "sent"       chiunque possa modificarlo
//
// "Lavori conclusi" = cantiere chiuso con "Concludi lavori" (works_completed_at).
// Lo sblocco di un blocco automatico (lock_override_at) vale finché non cambia
// lo stato del preventivo o non si concludono i lavori: poi si riblocca da solo.
// Il blocco non si salva come copia: si calcola, così non va mai fuori sincrono.
// ─────────────────────────────────────────────────────────────────────────────

export type LockReason = "admin" | "completed" | "rejected" | "sent";

export interface LockFields {
  status: string;
  isLocked: boolean;
  worksCompletedAt?: string | Date | null;
  lockOverrideAt?: string | Date | null;
}

/** Perché il preventivo è in sola lettura (null = modificabile). */
export function lockReason(q: LockFields): LockReason | null {
  if (q.isLocked) return "admin";
  if (q.lockOverrideAt) return null;
  if (q.status === "accepted" && q.worksCompletedAt) return "completed";
  if (q.status === "rejected") return "rejected";
  if (q.status === "sent") return "sent";
  return null;
}

/** Chi può togliere il blocco: l'admin sempre, gli altri solo per "inviato". */
export function canUnlock(reason: LockReason | null, role: string | null | undefined): boolean {
  if (!reason || !role || role === "viewer") return false;
  return role === "admin" || reason === "sent";
}

/** Può chiedere all'admin di sbloccare (blocchi che non può togliere da sé). */
export function canRequestUnlock(reason: LockReason | null, role: string | null | undefined): boolean {
  return !!reason && !!role && role !== "viewer" && !canUnlock(reason, role);
}

export const LOCK_TEXT: Record<LockReason, { title: string; body: string }> = {
  admin: {
    title: "Bloccato dall'amministratore",
    body: "Il preventivo è in sola lettura. Solo un amministratore può sbloccarlo.",
  },
  completed: {
    title: "Lavori conclusi",
    body: "Il preventivo è accettato e il cantiere è concluso: resta in sola lettura. Solo un amministratore può sbloccarlo.",
  },
  rejected: {
    title: "Preventivo rifiutato",
    body: "Il preventivo rifiutato è in sola lettura. Solo un amministratore può sbloccarlo.",
  },
  sent: {
    title: "Preventivo inviato",
    body: "È già stato inviato al cliente, quindi è bloccato per evitare modifiche per sbaglio. Puoi sbloccarlo tu.",
  },
};

/** Riassunto per i client (app iPhone): cosa mostrare e quali tasti offrire. */
export function lockInfo(
  q: LockFields & { unlockRequestedAt?: string | Date | null },
  role: string | null | undefined
) {
  const reason = lockReason(q);
  return {
    reason,
    locked: reason !== null,
    title: reason ? LOCK_TEXT[reason].title : null,
    message: reason ? LOCK_TEXT[reason].body : null,
    canUnlock: canUnlock(reason, role),
    canRequest: canRequestUnlock(reason, role),
    requestedAt: q.unlockRequestedAt ? new Date(q.unlockRequestedAt).toISOString() : null,
    /** Sbloccato a mano un blocco automatico: si può ribloccare. */
    canRelock: !reason && !!lockReason({ ...q, lockOverrideAt: null }) && !!role && role !== "viewer",
  };
}
