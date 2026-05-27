import React, { useEffect } from "react";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "../../../components/ui/input-otp";
import { Button } from "../../../components/ui/button";
import { Separator } from "../../../components/ui/separator";
import { Spinner } from "../../../components/ui/spinner";
import { HelpCircle } from "lucide-react";
import PlayerNew from "../controls/PlayerNew";
import { usePlayer } from "@/store/player";
import RoomNew from "@/pages/home/controls/RoomNew";
import Brand from "./Brand";
import { usePlayerRooms } from "@/store/room";
import { toast } from "sonner";
import { Badge } from "@/components";
import HowToPlayModal from "@/components/HowToPlayModal";

type Props = {
	roomCode: string;
	setRoomCode: (code: string) => void;
	validatedCode: boolean;
	setValidatedCode: (validated: boolean) => void;
	isLoading: boolean;
	handleEnterRoom: () => void;
};

export default function Home({
	roomCode,
	setRoomCode,
	validatedCode,
	setValidatedCode,
	isLoading,
	handleEnterRoom,
}: Readonly<Props>) {
	const { data: player } = usePlayer();
	const {
		data: playerRooms,
		refetch: refetchPlayerRooms,
		error: playerRoomsError,
	} = usePlayerRooms(player?.id ?? "");
	const [openCreateUser, setOpenCreateUser] = React.useState(false);
	const [openCreateRoom, setOpenCreateRoom] = React.useState(false);
	const [openHowToPlay, setOpenHowToPlay] = React.useState(false);

	useEffect(() => {
		if (player) {
			refetchPlayerRooms();
		}
	}, [player, refetchPlayerRooms]);

	const handleChange = (value: string) => {
		setValidatedCode(false);
		const formattedValue = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
		setRoomCode(formattedValue);
	};

	const handleCreateRoom = () => {
		if (!player) {
			setOpenCreateUser(true);
			return;
		}
		setOpenCreateRoom(true);
	};

	if (playerRoomsError) {
		toast.error("Failed to load your rooms. Please try again later.", {
			description: playerRoomsError.message,
		});
	}

	return (
		<div className={`p-8 mt-4 flex flex-col items-center gap-8`}>
			<Brand />

			<div className={`flex flex-col`}>
				<div className={`flex flex-col gap-4 border-2 p-8`}>
					<InputOTP
						maxLength={6}
						value={roomCode}
						onChange={handleChange}
						type='text'
						inputMode='text'
					>
						<InputOTPGroup>
							<InputOTPSlot
								index={0}
								aria-invalid={
									validatedCode && roomCode.length < 1
								}
							/>
							<InputOTPSlot
								index={1}
								aria-invalid={
									validatedCode && roomCode.length < 2
								}
							/>
							<InputOTPSlot
								index={2}
								aria-invalid={
									validatedCode && roomCode.length < 3
								}
							/>
						</InputOTPGroup>
						<InputOTPSeparator />
						<InputOTPGroup>
							<InputOTPSlot
								index={3}
								aria-invalid={
									validatedCode && roomCode.length < 4
								}
							/>
							<InputOTPSlot
								index={4}
								aria-invalid={
									validatedCode && roomCode.length < 5
								}
							/>
							<InputOTPSlot
								index={5}
								aria-invalid={
									validatedCode && roomCode.length < 6
								}
							/>
						</InputOTPGroup>
					</InputOTP>
					<Button
						variant={"linear"}
						size='lg'
						onClick={handleEnterRoom}
						disabled={isLoading}
					>
						{isLoading && <Spinner />}
						Enter Room
					</Button>
					<Separator className={`my-4`} label='or' />
					<Button
						variant='outline'
						size='lg'
						onClick={handleCreateRoom}
					>
						Create Room
					</Button>
				</div>
				<Button
					variant={"ghost"}
					size='xs'
					className={`mt-2 text-muted-foreground self-end`}
					onClick={() => setOpenHowToPlay(true)}
				>
					<HelpCircle className={`mr-1`} />
					How to play
				</Button>
			</div>

			{player && (
				<p className={`text-muted-foreground`}>
					Welcome back,{" "}
					<span className={`text-primary`}>{player.username}!</span>
				</p>
			)}

			<div className={`w-full max-w-md mx-auto`}>
				{playerRooms && playerRooms.length > 0 && (
					<div className={`flex flex-col gap-4 items-center`}>
						<h2 className={`text-lg font-semibold`}>Your Rooms</h2>
						<div className={`flex flex-col gap-4 w-full`}>
							{playerRooms.map((room) => (
								<div
									key={room.id}
									className='w-full flex justify-between items-center p-4 border rounded-lg cursor-pointer'
								>
									<div className={`flex flex-col`}>
										<span className='text-lg'>
											{room.name}
										</span>
										<Badge variant={"secondary"}>
											{room.code}
										</Badge>
									</div>
									<Button
										size='sm'
										onClick={() => {
											setRoomCode(room.code);
										}}
										disabled={isLoading}
									>
										Enter
									</Button>
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			<PlayerNew
				isOpen={openCreateUser}
				setIsOpen={setOpenCreateUser}
				navigateTo='/create-room'
			/>

			<RoomNew isOpen={openCreateRoom} setIsOpen={setOpenCreateRoom} />

			<HowToPlayModal
				open={openHowToPlay}
				onClose={() => setOpenHowToPlay(false)}
			/>
		</div>
	);
}
