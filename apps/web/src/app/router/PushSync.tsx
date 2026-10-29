import { usePlayer } from "@/features/home";
import { syncPushSubscription } from "@/shared/lib/pushNotifications";
import { useEffect } from "react";

// Keeps this device's push subscription saved for the signed-in player. The
// browser can rotate or drop a subscription at any time (a reinstall, cleared
// data, an iOS refresh), so it is re-saved on sign-in, whenever the app comes
// back to the foreground, and when the service worker reports a change.
export function PushSync() {
	const { data: player } = usePlayer();
	const playerId = player?.id;

	useEffect(() => {
		if (!playerId) return;
		void syncPushSubscription();

		const onVisible = () => {
			if (document.visibilityState === "visible") void syncPushSubscription();
		};
		const onMessage = (event: MessageEvent) => {
			if (event.data?.type === "push-subscription-changed") {
				void syncPushSubscription();
			}
		};

		document.addEventListener("visibilitychange", onVisible);
		navigator.serviceWorker?.addEventListener("message", onMessage);
		return () => {
			document.removeEventListener("visibilitychange", onVisible);
			navigator.serviceWorker?.removeEventListener("message", onMessage);
		};
	}, [playerId]);

	return null;
}
