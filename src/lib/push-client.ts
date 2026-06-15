// ─────────────────────────────────────────────────────────────────────────────
// Helper client per il Web Push: registrazione service worker, iscrizione e
// cancellazione. Usato da PushRegistrar (registra il SW) e dal toggle in Profilo.
// ─────────────────────────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Il browser supporta le notifiche push? */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Registra (idempotente) il service worker e ne restituisce la registration. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.error("[push] registrazione SW fallita:", err);
    return null;
  }
}

export type PushState = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
};

/** Stato corrente delle notifiche push su questo device. */
export async function getPushState(): Promise<PushState> {
  if (!isPushSupported())
    return { supported: false, permission: "unsupported", subscribed: false };
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!sub,
  };
}

/** Richiede il permesso, iscrive il device e invia la subscription al server. */
export async function subscribeToPush(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (!isPushSupported())
    return { ok: false, reason: "Notifiche non supportate su questo dispositivo." };
  if (!VAPID_PUBLIC_KEY)
    return { ok: false, reason: "Configurazione push mancante (VAPID)." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    return { ok: false, reason: "Permesso notifiche negato." };

  const reg =
    (await navigator.serviceWorker.getRegistration()) ??
    (await registerServiceWorker());
  if (!reg) return { ok: false, reason: "Service worker non disponibile." };
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  if (!res.ok) return { ok: false, reason: "Salvataggio iscrizione fallito." };
  return { ok: true };
}

/** Annulla l'iscrizione sul device e la rimuove dal server. */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
  return true;
}
