import { Button } from "@/components/ui/button";
import { Room } from "@/types";
import { HomeIcon, TrophyIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { RoomPreferencesDialog } from "./RoomPreferencesDialog";

type Props = {
	room: Room;
};

function RoomHeader({ room }: Readonly<Props>) {
	const navigate = useNavigate();

	const handleGoHome = () => {
		navigate("/");
	};

	const handleGoLeaderboard = () => {
		navigate(`/rooms/${room.code}/leaderboard`);
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
				<Link to={`/rooms/${room.code}`} className={`flex-1`}>
					<h1>{room.name}</h1>
				</Link>
				<Button
					variant='outline'
					size='sm'
					className={`cursor-pointer`}
					onClick={handleGoLeaderboard}
					title='Leaderboard'
				>
					<TrophyIcon />
				</Button>
				<RoomPreferencesDialog roomId={room.id} />
			</div>
		</header>
	);
}

export { RoomHeader };
