import { Button } from "@/components/ui/button";
import { Room } from "@/types";
import { CoinsIcon, HomeIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { usePlayer } from "@/store/player";
import { Badge } from "@/components";

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
				<div>
					{/* point */}
					<Badge
						variant='outline'
						className={`b-4 px-4 border-accent text-primary text-base`}
					>
						<CoinsIcon />
						{player?.points_balance ?? 0} pts
					</Badge>
				</div>
			</div>
		</header>
	);
}

export { RoomHeader };
