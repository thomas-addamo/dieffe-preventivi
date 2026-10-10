// Ponte verso l'app iPhone (cartella ios/): la pagina gira dentro un WKWebView
// con User-Agent "DieffeiOS/x.y" e un message handler "dieffe".

type IOSMessage =
  | { action: "pdf"; url: string; title: string }
  | { action: "badge"; count: number }
  | { action: "settings" };

interface IOSWindow {
  webkit?: { messageHandlers?: { dieffe?: { postMessage: (m: IOSMessage) => void } } };
}

export function isIOSApp(): boolean {
  return typeof window !== "undefined" && !!(window as IOSWindow).webkit?.messageHandlers?.dieffe;
}

/** Invia un messaggio all'app nativa; false se non siamo dentro l'app. */
export function postToIOSApp(message: IOSMessage): boolean {
  const handler = typeof window !== "undefined" ? (window as IOSWindow).webkit?.messageHandlers?.dieffe : undefined;
  if (!handler) return false;
  handler.postMessage(message);
  return true;
}
