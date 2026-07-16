import { Button } from "@/shared/ui/button";
import { Room } from "@/features/rooms";
import { ChevronLeftIcon, CoinsIcon, ZapIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/features/home";

export type RoomHeaderLeftAction = "home" | "back" | "none";

type Props = {
	room: Room;
	leftAction?: RoomHeaderLeftAction;
	title?: string;
	onLeftAction?: () => void;
};

function RoomHeader({
	room,
	leftAction = "home",
	title,
	onLeftAction,
}: Readonly<Props>) {
	const { data: player } = usePlayer();

	return (
		<header
			className={`p-4 sticky top-0 left-0 right-0 z-10 bg-secondary/30 backdrop-blur-sm border-b`}
		>
			<div className={`max-w-280 mx-auto flex gap-4 items-center`}>
				{leftAction === "none" ? (
					<div className='size-9' aria-hidden='true' />
				) : (
					<Button
						variant='linear'
						className={`cursor-pointer rounded-lg`}
						onClick={onLeftAction}
					>
						{leftAction === "back" ? (
							<ChevronLeftIcon />
						) : (
							<ZapIcon />
						)}
					</Button>
				)}
				<Link
					to={`/rooms/${room.code}`}
					className={`flex-1 font-bold truncate`}
				>
					<h1>{title ?? room.name}</h1>
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
