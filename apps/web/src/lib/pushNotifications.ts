import { upsertPushSubscription } from "@/lib/api";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;

const PUSH_OPT_IN_KEY = "predikt_push_opt_in_attempted";

function base64UrlToUint8Array(base64Url: string) {
	const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
	const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = globalThis.window.atob(base64);
	return Uint8Array.from([...rawData].map((char) => char.codePointAt(0)!));
}

function canUsePushNotifications() {
	return (
		globalThis.window !== undefined &&
		"Notification" in globalThis.window &&
		"serviceWorker" in navigator &&
		"PushManager" in globalThis.window &&
		(globalThis.window.isSecureContext || globalThis.window.location.hostname === "localhost")
	);
}

async function ensureNotificationPermission(forcePrompt = false) {
	if (Notification.permission === "granted") {
		return true;
	}

	if (Notification.permission === "denied") {
		return false;
	}

	if (!forcePrompt && localStorage.getItem(PUSH_OPT_IN_KEY) === "true") {
		return false;
	}

	localStorage.setItem(PUSH_OPT_IN_KEY, "true");
	return (await Notification.requestPermission()) === "granted";
}

export async function registerForPushNotifications(forcePrompt = false) {
	if (!canUsePushNotifications()) return;
	const vapidPublicKey = VAPID_PUBLIC_KEY?.trim();
	if (!vapidPublicKey) {
		console.warn("Push notifications skipped: missing VAPID public key.");
		return;
	}

	const existingRegistrations = await navigator.serviceWorker.getRegistrations();
	for (const existingRegistration of existingRegistrations) {
		const scriptUrl =
			existingRegistration.active?.scriptURL ??
			existingRegistration.installing?.scriptURL ??
			existingRegistration.waiting?.scriptURL ??
			"";
		if (scriptUrl.endsWith("/pwa-sw.js")) {
			await existingRegistration.unregister();
		}
	}

	const registration = await navigator.serviceWorker.register("/sw.js", {
		scope: "/",
	});

	const hasPermission = await ensureNotificationPermission(forcePrompt);
	if (!hasPermission) return;

	const existing = await registration.pushManager.getSubscription();
	const subscription =
		existing ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
		}));

	await upsertPushSubscription(subscription.toJSON());
}
