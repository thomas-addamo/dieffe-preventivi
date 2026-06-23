"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Notifiche native per l'app desktop (Electron).
//
// In Electron il Web Push (VAPID) NON funziona: Chromium non ha un servizio push
// in background come il telefono. Qui usiamo invece l'API Notification del
// renderer, che in Electron mostra notifiche native del sistema (Mac/Windows)
// MENTRE l'app è aperta. La preferenza è salvata in localStorage.
//
// Sul web (browser/PWA) questo modulo non viene usato: lì resta il Web Push.
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY = "desktop-notifications-enabled";

/** Siamo dentro l'app Electron? */
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && !!window.electron;
}

/** Notifiche native attive su questo computer? */
export function desktopNotificationsEnabled(): boolean {
  if (typeof window === "undefined" || typeof Notification === "undefined") return false;
  return localStorage.getItem(LS_KEY) === "1" && Notification.permission === "granted";
}

/** Permesso notifiche corrente (per la UI del toggle). */
export function desktopNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

/** Richiede il permesso al sistema e salva la preferenza. */
export async function enableDesktopNotifications(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (typeof Notification === "undefined")
    return { ok: false, reason: "Notifiche non supportate." };
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "Permesso notifiche negato." };
  localStorage.setItem(LS_KEY, "1");
  return { ok: true };
}

/** Disattiva le notifiche native (rimuove la preferenza). */
export function disableDesktopNotifications(): void {
  if (typeof window !== "undefined") localStorage.removeItem(LS_KEY);
}

/** Mostra una notifica nativa, se attive. onClick porta in primo piano l'app. */
export function showDesktopNotification(
  title: string,
  body: string | null,
  onClick?: () => void
): void {
  if (!desktopNotificationsEnabled()) return;
  try {
    const n = new Notification(title, { body: body ?? undefined });
    if (onClick)
      n.onclick = () => {
        window.focus();
        onClick();
      };
  } catch {
    // ignora: alcune piattaforme possono rifiutare la creazione
  }
}
