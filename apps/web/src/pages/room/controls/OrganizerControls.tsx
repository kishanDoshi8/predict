import { Button } from "../../../components/ui/button";
import { cn } from "@/lib/utils";
import { useRoomContext } from "@/pages/room/RoomLayout";
import { usePlayer } from "@/store/player";
import { Rocket } from "lucide-react";
import { useNavigate } from "react-router";

type CreatePredictionButtonProps = {
	className?: string;
};

function CreatePredictionButton({
	className,
}: Readonly<CreatePredictionButtonProps>) {
	const navigate = useNavigate();
	const { room } = useRoomContext();
	const { data: player } = usePlayer();

	if (!room) {
		navigate("/404");
		return null;
	}

	const isRoomAdmin = room.members.find(
		(m) => m.player_id === player?.id,
	)?.is_organizer;

	if (!isRoomAdmin) {
		return null;
	}

	return (
		<Button
			variant='default'
			size='lg'
			className={cn(`w-full mx-auto font-bold`, className)}
			onClick={() => navigate(`/rooms/${room.code}/predictions/new`)}
		>
			Create Prediction <Rocket className={`ml-2`} />
		</Button>
	);
}

export { CreatePredictionButton };
