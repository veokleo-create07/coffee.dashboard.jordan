/* Altstadtliebe staff push worker. Keep this file dependency-free. */
self.addEventListener("push", (event) => {
  const fallback = { title: "Altstadtliebe", body: "Eine neue Reservierung ist eingegangen.", url: "/dashboard/reservations" };
  let payload = fallback;
  try {
    if (event.data) payload = { ...fallback, ...event.data.json() };
  } catch {
    // A malformed push still receives a useful generic notification.
  }

  event.waitUntil(self.registration.showNotification(String(payload.title), {
    body: String(payload.body),
    icon: "/altstadtliebe-logo.png",
    badge: "/altstadtliebe-logo.png",
    data: { url: typeof payload.url === "string" ? payload.url : "/dashboard/reservations" },
    tag: "altstadtliebe-reservation",
    renotify: true,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/dashboard/reservations", self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = clients.find((client) => "focus" in client);
    if (existing) {
      await existing.focus();
      if ("navigate" in existing) await existing.navigate(target);
      return;
    }
    await self.clients.openWindow(target);
  })());
});
