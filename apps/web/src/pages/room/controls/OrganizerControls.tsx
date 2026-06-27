import { Button } from "../../../components/ui/button";
import { cn } from "@/lib/utils";
import { useRoomContext } from "@/pages/room/RoomLayout";
import { usePlayer } from "@/store/player";
import { useActivePredictions } from "@/store/prediction";
import { Rocket } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

type CreatePredictionButtonProps = {
	className?: string;
};

function CreatePredictionButton({
	className,
}: Readonly<CreatePredictionButtonProps>) {
	const navigate = useNavigate();
	const location = useLocation();
	const { room } = useRoomContext();
	const { data: predictions = [] } = useActivePredictions(room.id);
	const { data: player } = usePlayer();

	if (!room) {
		navigate("/404", { replace: true });
		return null;
	}

	const isRoomAdmin = room.members.find(
		(m) => m.player_id === player?.id,
	)?.is_organizer;

	const activeCount = predictions.filter(
		(p) => p.status === "draft" || p.status === "locked",
	).length;

	const canCreatePrediction = activeCount < room.predictions_limit;

	if (!isRoomAdmin || !canCreatePrediction) {
		return null;
	}

	return (
		<div
			className={`bg-background p-4 border-t-2 mt-4 sticky left-4 right-4 bottom-0 z-50 w-full max-w-md mx-auto`}
		>
			<Button
				variant='linear'
				size='lg'
				className={cn(
					`w-full mx-auto font-bold shadow-lg text-foreground`,
					className,
				)}
				onClick={() =>
					navigate(`/rooms/${room.code}/predictions/new`, {
						state: { from: location.pathname },
					})
				}
			>
				<Rocket className={`ml-2`} />
				Create Prediction
			</Button>
		</div>
	);
}

export { CreatePredictionButton };
