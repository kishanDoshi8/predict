import { upsertPushSubscription } from "@/shared/lib/api";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;

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

export async function registerForPushNotifications(
	permission: NotificationPermission = "default",
) {
	if (!canUsePushNotifications()) return;
	if (permission !== "granted") return;
	const vapidPublicKey = VAPID_PUBLIC_KEY?.trim();
	if (!vapidPublicKey) {
		console.warn("Push notifications skipped: missing VAPID public key.");
		return;
	}

	const registration =
		(await navigator.serviceWorker.getRegistration("/")) ??
		(await navigator.serviceWorker.register("/sw.js", {
			scope: "/",
		}));

	const existing = await registration.pushManager.getSubscription();
	const subscription =
		existing ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
		}));

	await upsertPushSubscription(subscription.toJSON());
}
