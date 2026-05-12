import { Badge, Button } from "@/components";
import { usePlayer } from "@/store/player";
import { Room } from "@/types";
import { HomeIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RoomPreferencesDialog } from "./RoomPreferencesDialog";

type Props = {
	room: Room;
};

function RoomHeader({ room }: Readonly<Props>) {
	const navigate = useNavigate();
	const { data: player } = usePlayer();

	const handleGoHome = () => {
		navigate("/");
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
					onClick={handleGoHome}
				>
					<HomeIcon />
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
