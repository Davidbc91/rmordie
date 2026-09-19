/* RM OR DIE — service worker dedicado a notificaciones push.
   No cachea nada ni interfiere con la app: solo recibe avisos y los abre. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "RM OR DIE";
  const url = payload.url || "/chat";
  const tag = payload.tag || "rmordie";

  event.waitUntil(
    (async () => {
      // Si ya está el chat abierto y visible, no molestamos con el aviso.
      if (payload.skipIfVisible) {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const focused = clients.some(
          (c) => c.visibilityState === "visible" && c.url.includes(payload.skipIfVisible),
        );
        if (focused) return;
      }

      await self.registration.showNotification(title, {
        body: payload.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag,
        renotify: true,
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/chat";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
