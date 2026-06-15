/* Service worker Dieffe Preventivi — Web Push nativo.
 * Mostra le notifiche di sistema (centro notifiche iOS/macOS) e, quando l'app
 * è aperta, avvisa il client per aggiornare la campanella in tempo reale.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Dieffe Preventivi", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Dieffe Preventivi";
  const options = {
    body: data.body || "",
    icon: "/icona_dieffe.svg",
    badge: "/icona_dieffe.svg",
    tag: data.tag || undefined,
    data: { url: data.url || "/dashboard" },
    // Su Android/desktop riallinea le notifiche con lo stesso tag.
    renotify: !!data.tag,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Avvisa eventuali finestre aperte per aggiornare la UI in tempo reale.
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
        (clients) => {
          for (const client of clients) {
            client.postMessage({ type: "notification", data });
          }
        }
      ),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Se c'è già una finestra aperta, portala in primo piano e naviga.
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(url).catch(() => {});
            return;
          }
        }
        // Altrimenti apri una nuova finestra.
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
