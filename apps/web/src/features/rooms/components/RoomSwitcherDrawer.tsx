import { RoomCardsList, usePlayerRooms } from "@/features/rooms";
import {
	Button,
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/ui";
import { HouseIcon, PlusIcon, UsersIcon } from "lucide-react";
import React, { Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";

const HowToPlayModal = lazy(
	() => import("@/features/onboarding/components/HowToPlayModal"),
);

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	playerId: string;
};

export function RoomSwitcherDrawer({
	open,
	onOpenChange,
	playerId,
}: Readonly<Props>) {
	const navigate = useNavigate();
	const [openHowToPlay, setOpenHowToPlay] = React.useState(false);
	const {
		data: playerRooms,
		isPending: isPlayerRoomsLoading,
		error: playerRoomsError,
	} = usePlayerRooms(playerId);

	const handleOpenTab = (tab: "join" | "create") => {
		onOpenChange(false);
		navigate(`/?tab=${tab}`);
	};

	const handleHowToPlay = () => {
		onOpenChange(false);
		setOpenHowToPlay(true);
	};

	return (
		<>
			<Drawer open={open} onOpenChange={onOpenChange} direction='left'>
				<DrawerContent className='h-dvh'>
					<DrawerHeader>
						<DrawerTitle>Your Rooms</DrawerTitle>
						{playerRooms ? (
							<p className='text-sm text-muted-foreground'>
								{playerRooms.length} rooms
							</p>
						) : null}
					</DrawerHeader>

					<div className='flex-1 overflow-y-auto px-4 pb-4'>
						<RoomCardsList
							rooms={playerRooms}
							isLoading={isPlayerRoomsLoading}
							error={playerRoomsError}
							onRoomSelect={() => onOpenChange(false)}
						/>
					</div>

					<DrawerFooter className='border-t'>
						<Button
							variant='outline'
							className='w-full justify-start'
							onClick={() => handleOpenTab("create")}
						>
							<PlusIcon />
							Create Room
						</Button>
						<Button
							variant='outline'
							className='w-full justify-start'
							onClick={() => handleOpenTab("join")}
						>
							<UsersIcon />
							Join Room
						</Button>
						<Button
							variant='outline'
							className='w-full justify-start'
							onClick={handleHowToPlay}
						>
							<HouseIcon />
							How To Play
						</Button>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>

			{openHowToPlay ? (
				<Suspense fallback={null}>
					<HowToPlayModal
						open={openHowToPlay}
						onClose={() => setOpenHowToPlay(false)}
					/>
				</Suspense>
			) : null}
		</>
	);
}
