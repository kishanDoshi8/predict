import { usePlayer } from "@/features/home";
import { useRoom } from "@/features/rooms/hooks/room";
import { Loading } from "@/shared/ui";
import { Navigate, Outlet, useParams, useLocation } from "react-router-dom";
import { savePostAuthRedirect } from "@/shared/lib/postAuthRedirect";

export function RequireRoomMember() {
	const { roomCode } = useParams<{ roomCode: string }>();
	const location = useLocation();
	const { data: player, isPending: isPlayerLoading } = usePlayer();
	const { data: room, isPending: isRoomLoading, isError } = useRoom(roomCode);

	if (isPlayerLoading || isRoomLoading) {
		return (
			<div className='flex items-center justify-center h-dvh'>
				<Loading className='size-10 text-primary' />
			</div>
		);
	}

	if (!player) {
		// New here: pick a name first, then come straight back to this room.
		savePostAuthRedirect(`${location.pathname}${location.search}`);
		return <Navigate to='/create-player' replace />;
	}

	if (!room || isError || room.code !== roomCode) {
		return <Navigate to='/404' replace />;
	}

	const isMember = room.members.some((member) => member.player_id === player.id);

	if (!isMember) {
		// Keep where they were heading (e.g. a shared prediction) for after joining.
		const next = encodeURIComponent(`${location.pathname}${location.search}`);
		return <Navigate to={`/rooms/${room.code}/join?next=${next}`} replace />;
	}

	return <Outlet />;
}
