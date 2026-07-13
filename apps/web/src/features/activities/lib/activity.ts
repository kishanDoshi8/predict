import { RoomActivity } from "@/features/activities/types/types";

export function formatPoints(value: number | null | undefined) {
	if (typeof value !== "number" || Number.isNaN(value)) {
		return "0";
	}
	return value.toLocaleString();
}

export function formatActivityTimestamp(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

export function resolveActivityHref(activity: RoomActivity, roomCode: string) {
	const action = activity.clickAction;
	if (!action) {
		return null;
	}

	if (action.type === "prediction") {
		return `/rooms/${roomCode}/predictions/${action.predictionId}`;
	}

	if (action.type === "duel") {
		return `/rooms/${roomCode}/predictions/${action.predictionId}/duels/${action.duelId}`;
	}

	return null;
}
