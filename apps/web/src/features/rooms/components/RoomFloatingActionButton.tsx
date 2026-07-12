import { useRoomContext } from "@/app/layouts/RoomLayout";
import { usePlayer } from "@/features/home";
import { useActivePredictions } from "@/features/predictions";
import { Button } from "@/shared/ui";
import { RocketIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export function RoomFloatingActionButton() {
	const navigate = useNavigate();
	const location = useLocation();
	const { room } = useRoomContext();
	const { data: predictions = [] } = useActivePredictions(room.id);
	const { data: player } = usePlayer();

	const isRoomAdmin = room.members.find(
		(member) => member.player_id === player?.id,
	)?.is_organizer;

	const activeCount = predictions.filter(
		(prediction) =>
			prediction.status === "draft" || prediction.status === "locked",
	).length;

	const canCreatePrediction = activeCount < room.predictions_limit;

	if (!isRoomAdmin || !canCreatePrediction) {
		return null;
	}

	return (
		<div
			className='fixed right-4 z-50'
			style={{
				bottom: "calc(4.5rem + env(safe-area-inset-bottom))",
			}}
		>
			<Button
				type='button'
				variant='linear'
				size='icon-lg'
				className='rounded-full shadow-lg'
				onClick={() =>
					navigate(`/rooms/${room.code}/predictions/new`, {
						state: { from: location.pathname },
					})
				}
				aria-label='Create prediction'
			>
				<RocketIcon />
			</Button>
		</div>
	);
}
