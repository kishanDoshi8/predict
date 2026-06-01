self.addEventListener("fetch", (event) => {
	event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
	let payload = {};

	if (event.data) {
		try {
			payload = event.data.json();
		} catch {
			payload = { body: event.data.text() };
		}
	}

	const title = payload.title ?? "Predikt";
	const options = {
		body: payload.body ?? "You have a new notification.",
		icon: "/pwa-192x192.png",
		badge: "/pwa-192x192.png",
		data: payload.data ?? {},
	};

	event.waitUntil(
		globalThis.self.registration.showNotification(title, options),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const targetUrl = event.notification.data?.url ?? "/";
	const absoluteTargetUrl = new URL(targetUrl, self.location.origin).href;

	event.waitUntil(
		clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clientList) => {
				for (const client of clientList) {
					if ("focus" in client && client.url === absoluteTargetUrl) {
						return client.focus();
					}
				}

				if (clients.openWindow) {
					return clients.openWindow(absoluteTargetUrl);
				}

				return undefined;
			}),
	);
});
