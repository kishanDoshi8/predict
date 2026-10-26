import { Button } from "@/shared/ui/button";
import { useRoomRole } from "@/features/rooms";
import { Room, RoomMenuDrawer } from "@/features/rooms";
import {
	BellIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	EllipsisVerticalIcon,
	LayoutGridIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/shared/ui";
import type { MouseEvent } from "react";
import { useAppNavigation } from "@/shared/lib/navigation";
import { useState } from "react";
import {
	SeriesPickerDrawer,
	WalletPopover,
	useCurrentSeries,
	useSeriesWallet,
} from "@/features/series";
import { RoomPreferencesDialog } from "@/features/preferences";
import { cn } from "@/shared/lib/utils";

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
	// The whole room view follows one series: points, Home, Standings, History.
	const {
		currentSeries,
		currentSeriesId,
		isPending: isSeriesPending,
	} = useCurrentSeries(room.id);
	const { wallet } = useSeriesWallet(room.id, currentSeriesId);
	const [isSeriesPickerOpen, setIsSeriesPickerOpen] = useState(false);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

	const { can } = useRoomRole(room);
	const isOrganizer = can.organize;
	const canResolve = can.resolve;
	const { up } = useAppNavigation();
	const roomHome = `/rooms/${room.code}`;
	// The room name goes back to the room's Home and clears the pages above.
	const goHome = (event: MouseEvent<HTMLAnchorElement>) => {
		event.preventDefault();
		up(roomHome);
	};

	return (
		<header
			className={`px-3 py-3 sticky top-0 left-0 right-0 z-10 bg-secondary/30 backdrop-blur-sm border-b`}
		>
			<div className={`max-w-280 mx-auto flex gap-2 items-center`}>
				{leftAction === "none" ? (
					<div className='size-9' aria-hidden='true' />
				) : (
					<Button
						variant='linear'
						size='icon'
						className={`cursor-pointer rounded-lg shrink-0`}
						onClick={onLeftAction}
						aria-label={
							leftAction === "back" ? "Back" : "Switch room"
						}
					>
						{leftAction === "back" ? (
							<ChevronLeftIcon />
						) : (
							<LayoutGridIcon />
						)}
					</Button>
				)}

				<div className='flex-1 min-w-0 flex flex-col leading-tight'>
					{title ? (
						<>
							<h1 className='font-bold truncate'>{title}</h1>
							<Link
								to={roomHome}
								onClick={goHome}
								className='text-xs text-muted-foreground truncate'
							>
								{room.name}
							</Link>
						</>
					) : (
						<>
							<Link
								to={roomHome}
								onClick={goHome}
								className='font-bold truncate'
							>
								<h1 className='truncate'>{room.name}</h1>
							</Link>
							<button
								type='button'
								onClick={() => setIsSeriesPickerOpen(true)}
								className='flex items-center gap-0.5 self-start max-w-full text-xs text-muted-foreground hover:text-foreground'
								aria-label={`Series: ${currentSeries?.title ?? "none"}. Change series`}
							>
								<span className='truncate'>
									{isSeriesPending ? (
										<Skeleton className='my-0.5 h-3 w-24' />
									) : (currentSeries?.title ??
										(isOrganizer
											? "Start a series"
											: "No series yet"))}
								</span>
								<ChevronDownIcon className='size-3.5 shrink-0' />
							</button>
						</>
					)}
				</div>

				{wallet ? <WalletPopover wallet={wallet} /> : null}

				<Button
					variant='ghost'
					size='icon'
					className='relative shrink-0'
					asChild
				>
					<Link
						to={`/rooms/${room.code}/activities`}
						aria-label={
							room.has_unseen_activities
								? "Activity, new updates"
								: "Activity"
						}
					>
						<BellIcon />
						<span
							className={cn(
								"absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-background",
								!room.has_unseen_activities && "hidden",
							)}
							aria-hidden='true'
						/>
					</Link>
				</Button>

				<Button
					variant='ghost'
					size='icon'
					className='shrink-0'
					onClick={() => setIsMenuOpen(true)}
					aria-label='Room menu'
				>
					<EllipsisVerticalIcon />
				</Button>
			</div>

			<SeriesPickerDrawer
				roomId={room.id}
				roomCode={room.code}
				isOrganizer={isOrganizer}
				open={isSeriesPickerOpen}
				onOpenChange={setIsSeriesPickerOpen}
			/>
			<RoomMenuDrawer
				room={room}
				open={isMenuOpen}
				onOpenChange={setIsMenuOpen}
				onOpenNotifications={() => setIsNotificationsOpen(true)}
			/>
			<RoomPreferencesDialog
				roomId={room.id}
				isStaff={canResolve}
				open={isNotificationsOpen}
				onOpenChange={setIsNotificationsOpen}
			/>
		</header>
	);
}

export { RoomHeader };
