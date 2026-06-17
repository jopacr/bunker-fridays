// Service worker for Bunker Fridays. Handles Web Push notifications from the
// venue (open-date pings) and focuses or opens the app on tap. A ping payload
// carries { dateISO } so the app can deep-link straight into requesting it.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = {}; }
  const title = payload.title || "The Bunker";
  const body = payload.body || "You have a new message from The Bunker.";
  const dateISO = payload.data && payload.data.dateISO;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: dateISO ? `bunker-ping-${dateISO}` : "bunker-ping",
      data: { url: dateISO ? `/?request=${dateISO}` : "/?page=mine" },
      badge: "/icon-192.png",
      icon: "/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
