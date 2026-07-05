import { useCallback, useEffect, useState } from "react";

export type NotificationPermissionState = "granted" | "default" | "denied";

const getBrowserNotificationPermission = (): NotificationPermissionState => {
	if (typeof globalThis.window === "undefined") return "denied";
	if (!("Notification" in globalThis.window)) return "denied";
	return Notification.permission;
};

export function useNotificationPermission() {
	const [permission, setPermission] =
		useState<NotificationPermissionState>("default");

	const refreshPermission = useCallback(() => {
		setPermission(getBrowserNotificationPermission());
	}, []);

	const requestPermission = useCallback(async () => {
		if (typeof globalThis.window === "undefined") {
			setPermission("denied");
			return "denied" as const;
		}

		if (!("Notification" in globalThis.window)) {
			setPermission("denied");
			return "denied" as const;
		}

		const currentPermission = getBrowserNotificationPermission();
		if (currentPermission === "denied" || currentPermission === "granted") {
			setPermission(currentPermission);
			return currentPermission;
		}

		const nextPermission = await Notification.requestPermission();
		setPermission(nextPermission);
		return nextPermission;
	}, []);

	useEffect(() => {
		refreshPermission();
	}, [refreshPermission]);

	return {
		permission,
		refreshPermission,
		requestPermission,
	};
}
