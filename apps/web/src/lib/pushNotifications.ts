import { upsertPushSubscription } from "@/lib/api";

const VAPID_PUBLIC_KEY =
	import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY ?? "PASTE_YOUR_PUBLIC_VAPID_KEY_HERE";

const PUSH_OPT_IN_KEY = "predikt_push_opt_in_attempted";

function base64UrlToUint8Array(base64Url: string) {
	const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
	const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = window.atob(base64);
	return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function canUsePushNotifications() {
	return (
		typeof window !== "undefined" &&
		"Notification" in window &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		(window.isSecureContext || window.location.hostname === "localhost")
	);
}

async function ensureNotificationPermission() {
	if (Notification.permission === "granted") {
		return true;
	}

	if (Notification.permission === "denied") {
		return false;
	}

	if (localStorage.getItem(PUSH_OPT_IN_KEY) === "true") {
		return false;
	}

	localStorage.setItem(PUSH_OPT_IN_KEY, "true");
	return (await Notification.requestPermission()) === "granted";
}

export async function registerForPushNotifications(playerToken: string) {
	if (!playerToken) return;
	if (!canUsePushNotifications()) return;
	if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY === "PASTE_YOUR_PUBLIC_VAPID_KEY_HERE")
		return;

	const registration = await navigator.serviceWorker.register("/sw.js", {
		scope: "/",
	});

	const hasPermission = await ensureNotificationPermission();
	if (!hasPermission) return;

	const existing = await registration.pushManager.getSubscription();
	const subscription =
		existing ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
		}));

	await upsertPushSubscription(playerToken, subscription.toJSON());
}
