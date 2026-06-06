import { Button } from "@/components/ui/button";
import { Room } from "@/types";
import { CoinsIcon, HomeIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { usePlayer } from "@/store/player";

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
			className={`p-4 sticky top-0 left-0 right-0 z-10 bg-secondary/30 backdrop-blur-sm border-b`}
		>
			<div className={`max-w-280 mx-auto flex gap-4 items-center`}>
				<Button
					variant='linear'
					// size='sm'
					className={`cursor-pointer rounded-lg`}
					onClick={handleGoHome}
				>
					<HomeIcon />
				</Button>
				<Link
					to={`/rooms/${room.code}`}
					className={`flex-1 font-bold truncate`}
				>
					<h1>{room.name}</h1>
				</Link>
				<div>
					{/* point */}
					<Button
						variant='ghost'
						size='sm'
						className={`text-accent text-base cursor-default`}
					>
						<CoinsIcon />
						{(player?.points_balance ?? 0).toLocaleString()}
					</Button>
				</div>
			</div>
		</header>
	);
}

export { RoomHeader };
