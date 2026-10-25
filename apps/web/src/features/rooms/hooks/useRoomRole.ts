import { usePlayer } from "@/features/home";
import { hasRoomRole, type RoomRole } from "@/features/rooms/lib/roles";
import type { Room } from "@/features/rooms/types/types";

// The signed-in player's role in this room, and what it lets them do.
export function useRoomRole(room: Pick<Room, "members"> | null | undefined) {
	const { data: player } = usePlayer();
	const role =
		room?.members.find((member) => member.player_id === player?.id)?.role ??
		null;

	return {
		role,
		can: {
			// Reveal, mark no result, cancel.
			resolve: hasRoomRole(role, "resolver"),
			// Create and edit predictions and series.
			organize: hasRoomRole(role, "organizer"),
			// Room settings, roles, archiving.
			own: role === "owner",
		},
	} satisfies { role: RoomRole | null; can: Record<string, boolean> };
}
