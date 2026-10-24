self.addEventListener("install", () => {
	globalThis.self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
	// Bundles, images and API calls go straight to the network untouched.
	if (event.request.mode !== "navigate") return;
	// Opening the app must never be answered by a stale cached page, so the
	// page is always checked with the server (a cheap 304 when unchanged).
	event.respondWith(
		fetch(new Request(event.request, { cache: "no-cache" })).catch(() =>
			fetch(event.request),
		),
	);
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
		icon: payload.icon ?? "/pwa-192x192.png",
		badge: payload.badge ?? "/notification-badge-96.png",
		image: payload.image,
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
