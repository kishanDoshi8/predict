import { deletePushSubscription, upsertPushSubscription } from "@/shared/lib/api";

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

// iPhones and iPads only get web push once the app is on the Home Screen.
export function needsHomeScreenInstall() {
	if (globalThis.window === undefined) return false;
	const isAppleMobile =
		/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
	const isStandalone =
		globalThis.window.matchMedia?.("(display-mode: standalone)").matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true;
	return isAppleMobile && !isStandalone;
}

export type PushSetupResult =
	| "subscribed"
	| "needs-install"
	| "unsupported"
	| "no-permission"
	| "misconfigured";

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array) {
	if (!a) return false;
	const bytes = new Uint8Array(a);
	return bytes.length === b.length && bytes.every((byte, i) => byte === b[i]);
}

async function getRegistration() {
	return (
		(await navigator.serviceWorker.getRegistration("/")) ??
		(await navigator.serviceWorker.register("/sw.js", { scope: "/" }))
	);
}

// Subscribes this device and saves it for the signed-in player. Safe to call
// any number of times: it reuses the browser's subscription, replaces one made
// for an old key, and always re-saves it, so a rotated or lost endpoint heals.
// Throws if the save fails.
export async function registerForPushNotifications(
	permission: NotificationPermission = "default",
): Promise<PushSetupResult> {
	if (needsHomeScreenInstall()) return "needs-install";
	if (!canUsePushNotifications()) return "unsupported";
	if (permission !== "granted") return "no-permission";
	const vapidPublicKey = VAPID_PUBLIC_KEY?.trim();
	if (!vapidPublicKey) {
		console.warn("Push notifications skipped: missing VAPID public key.");
		return "misconfigured";
	}

	const applicationServerKey = base64UrlToUint8Array(vapidPublicKey);
	const registration = await getRegistration();

	let subscription = await registration.pushManager.getSubscription();
	if (
		subscription &&
		!sameKey(subscription.options.applicationServerKey, applicationServerKey)
	) {
		await subscription.unsubscribe();
		subscription = null;
	}

	subscription ??= await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey,
	});

	await upsertPushSubscription(subscription.toJSON());
	return "subscribed";
}

// Quietly re-saves this device's subscription when notifications are already
// allowed. Run on sign-in and whenever the app comes back to the foreground.
export async function syncPushSubscription() {
	if (globalThis.window === undefined || !("Notification" in globalThis.window)) {
		return;
	}
	if (Notification.permission !== "granted") return;

	try {
		await registerForPushNotifications("granted");
	} catch (error) {
		console.warn("Couldn't re-sync push subscription", error);
	}
}

// Stops pushes to this device for the signed-in player. Run before sign-out.
export async function removePushSubscription() {
	if (!canUsePushNotifications()) return;

	try {
		const registration = await navigator.serviceWorker.getRegistration("/");
		const subscription = await registration?.pushManager.getSubscription();
		if (!subscription) return;
		await deletePushSubscription(subscription.endpoint);
		await subscription.unsubscribe();
	} catch (error) {
		console.warn("Couldn't remove push subscription", error);
	}
}
