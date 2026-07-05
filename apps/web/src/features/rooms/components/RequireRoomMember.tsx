import { usePlayer } from "@/features/home";
import { useRoom } from "@/features/rooms/hooks/room";
import { Loading } from "@/shared/ui";
import { Navigate, Outlet, useParams } from "react-router-dom";

export function RequireRoomMember() {
	const { roomCode } = useParams<{ roomCode: string }>();
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
		return <Navigate to='/create-player' replace />;
	}

	if (!room || isError || room.code !== roomCode) {
		return <Navigate to='/404' replace />;
	}

	const isMember = room.members.some((member) => member.player_id === player.id);

	if (!isMember) {
		return <Navigate to={`/rooms/${room.code}/join`} replace />;
	}

	return <Outlet />;
}
