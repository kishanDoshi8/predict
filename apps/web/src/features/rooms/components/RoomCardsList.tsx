import { Room } from "@/features/rooms";
import { Badge, Skeleton } from "@/shared/ui";
import { ChevronRightIcon, UsersIcon, ZapIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Props = {
	rooms?: Room[];
	isLoading?: boolean;
	error?: Error | null;
	emptyMessage?: string;
	onRoomSelect?: (room: Room) => void;
};

export function RoomCardsList({
	rooms,
	isLoading = false,
	error = null,
	emptyMessage = "You have not joined any rooms yet.",
	onRoomSelect,
}: Readonly<Props>) {
	if (error) {
		toast.error("Failed to load your rooms. Please try again later.", {
			description: error.message,
			position: "top-center",
		});
	}

	if (isLoading) {
		return (
			<div className={`flex flex-col gap-2`}>
				{[1, 2].map((i) => (
					<Skeleton
						key={i}
						className={`w-full h-21 rounded-lg bg-secondary animate-pulse`}
					/>
				))}
			</div>
		);
	}

	if (!rooms || rooms.length === 0) {
		return <p className={`text-muted-foreground`}>{emptyMessage}</p>;
	}

	return (
		<div className={`flex flex-col gap-4 items-center`}>
			<div className={`flex flex-col gap-2 w-full`}>
				{rooms.map((room) => (
					<Link
						to={`/rooms/${room.code}`}
						key={room.id}
						onClick={() => onRoomSelect?.(room)}
						className='w-full flex justify-between items-center p-4 rounded-lg cursor-pointer bg-card hover:border-primary/50'
					>
						<div className={`flex flex-col`}>
							<span className='text-lg font-semibold'>
								{room.name}
							</span>
							<div className={`flex items-center gap-4`}>
								<Badge
									variant={"secondary"}
									className={`rounded-md text-muted-foreground`}
								>
									{room.code}
								</Badge>
								<div
									className={`flex items-center gap-0.5 text-sm text-muted-foreground`}
								>
									<UsersIcon
										className={`w-3 h-3 text-muted-foreground`}
									/>
									<span
										className={`text-sm text-muted-foreground`}
									></span>
									{room.member_count ?? room.members.length}
								</div>
								{room.active_prediction_count != undefined &&
									room.active_prediction_count > 0 && (
										<div
											className={`flex items-center gap-1 text-sm text-primary`}
										>
											<ZapIcon className={`w-3 h-3`} />
											<span className={`text-sm`}>
												{room.active_prediction_count}
											</span>
											<span>live</span>
										</div>
									)}
							</div>
						</div>
						<ChevronRightIcon
							className={`w-6 h-6 text-muted-foreground`}
						/>
					</Link>
				))}
			</div>
		</div>
	);
}
