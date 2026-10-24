import type { ShareKind } from "@/shared/lib/referral";

// A link into the room that remembers which shareable it came from and, for a
// prediction or series, takes a new friend straight there after joining.
export function shareLink(roomCode: string, ref: ShareKind, next?: string) {
	const params = new URLSearchParams({ ref });
	if (next) params.set("next", next);
	return `${globalThis.location.origin}/rooms/${roomCode}/join?${params.toString()}`;
}

export function shareHost() {
	return globalThis.location.host;
}
