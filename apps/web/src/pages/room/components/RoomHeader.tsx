import { Badge, Button } from "@/components";
import { usePlayer } from "@/store/player";
import { Room } from "@/types";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RoomPreferencesDialog } from "./RoomPreferencesDialog";

type Props = {
	room: Room;
};

function RoomHeader({ room }: Readonly<Props>) {
	const navigate = useNavigate();
	const { data: player } = usePlayer();

	const handleGoBack = () => {
		// if current page is /room/:id, navigate to home else -1
		console.log(globalThis.location);
		if (globalThis.location.pathname === `/room/${room.code}`) {
			navigate("/");
			return;
		}

		navigate(-1);
	};

	return (
		<header
			className={`p-4 sticky top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-sm border-b`}
		>
			<div className={`max-w-280 mx-auto flex gap-4 items-center`}>
				<Button
					variant='outline'
					size='sm'
					className={`cursor-pointer`}
					onClick={handleGoBack}
				>
					<ArrowLeft />
				</Button>
				<h1 className={`flex-1`}>{room.name}</h1>
				<Badge variant={"secondary"}>
					<p>{player?.points_balance ?? 0} PTS</p>
				</Badge>
				<RoomPreferencesDialog roomId={room.id} />
			</div>
		</header>
	);
}

export { RoomHeader };
