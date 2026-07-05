import React, { Suspense, lazy } from "react";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@/shared/ui/input-otp";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import {
	ChevronRightIcon,
	CircleQuestionMark,
	TriangleAlert,
	UsersIcon,
	ZapIcon,
} from "lucide-react";
import { usePlayer } from "@/features/home";
import Brand from "./Brand";
import { useCreateRoom, usePlayerRooms } from "@/features/rooms";
import { toast } from "sonner";
import {
	Badge,
	Input,
	Skeleton,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/ui";
import { Link, useNavigate } from "react-router-dom";

const HowToPlayModal = lazy(() => import("@/features/onboarding/components/HowToPlayModal"));

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
	const [openHowToPlay, setOpenHowToPlay] = React.useState(false);

	return (
		<div className={`p-8 mt-4 flex flex-col items-center gap-8`}>
			<Brand />

			{player && (
				<p className={`text-muted-foreground`}>
					Welcome back,{" "}
					<span className={`text-accent`}>{player.username}!</span>
				</p>
			)}

			<div className={`w-full max-w-md mx-auto`}>
				<Tabs defaultValue='rooms'>
					<TabsList className={`w-full `}>
						<TabsTrigger value='rooms'>Your Rooms</TabsTrigger>
						<TabsTrigger value='join'># Join</TabsTrigger>
						<TabsTrigger value='create'>Create Room</TabsTrigger>
					</TabsList>
					<TabsContent value='rooms'>
						<YourRooms />
					</TabsContent>
					<TabsContent value='join'>
						<JoinRoom
							roomCode={roomCode}
							setRoomCode={setRoomCode}
							validatedCode={validatedCode}
							setValidatedCode={setValidatedCode}
							isLoading={isLoading}
							handleEnterRoom={handleEnterRoom}
						/>
					</TabsContent>
					<TabsContent value='create'>
						<CreateRoom />
					</TabsContent>
				</Tabs>
			</div>

			<div className={`fixed bottom-4 right-4`}>
				<Button
					variant='outline'
					className={`text-muted-foreground`}
					size='sm'
					onClick={() => setOpenHowToPlay(true)}
				>
					<CircleQuestionMark />
					How to Play
				</Button>
			</div>

			{openHowToPlay ? (
				<Suspense fallback={null}>
					<HowToPlayModal
						open={openHowToPlay}
						onClose={() => setOpenHowToPlay(false)}
					/>
				</Suspense>
			) : null}
		</div>
	);
}

function YourRooms() {
	const { data: player } = usePlayer();
	const {
		data: playerRooms,
		isPending: isLoading,
		error: playerRoomsError,
	} = usePlayerRooms(player?.id ?? "");

	if (playerRoomsError) {
		toast.error("Failed to load your rooms. Please try again later.", {
			description: playerRoomsError.message,
			position: "top-center",
		});
	}

	let content;
	if (isLoading) {
		content = (
			<div className={`flex flex-col gap-2`}>
				{[1, 2].map((i) => (
					<Skeleton
						key={i}
						className={`w-full h-21 rounded-lg bg-secondary animate-pulse`}
					/>
				))}
			</div>
		);
	} else if (playerRooms && playerRooms.length > 0) {
		content = (
			<div className={`flex flex-col gap-4 items-center`}>
				<div className={`flex flex-col gap-2 w-full`}>
					{playerRooms.map((room) => (
						<Link
							to={`/rooms/${room.code}`}
							key={room.id}
							className='w-full flex justify-between items-center p-4 border rounded-lg cursor-pointer hover:border-primary/50'
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
										{room.member_count ??
											room.members.length}
									</div>
									{room.active_prediction_count !=
										undefined &&
										room.active_prediction_count > 0 && (
											<div
												className={`flex items-center gap-1 text-sm text-primary`}
											>
												<ZapIcon
													className={`w-3 h-3`}
												/>
												<span className={`text-sm`}>
													{
														room.active_prediction_count
													}
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
	} else {
		content = (
			<p className={`text-muted-foreground`}>
				You have not joined any rooms yet.
			</p>
		);
	}

	return <div className={`mt-4`}>{content}</div>;
}

function JoinRoom({
	roomCode,
	setRoomCode,
	validatedCode,
	setValidatedCode,
	isLoading,
	handleEnterRoom,
}: Readonly<Props>) {
	const handleChange = (value: string) => {
		setValidatedCode(false);
		const formattedValue = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
		setRoomCode(formattedValue);
	};

	return (
		<div className={`flex flex-col mt-4 border-2 p-8 rounded-lg`}>
			<h2 className={`text-center text-xl font-semibold`}>
				Enter Room Code
			</h2>
			<p className={`text-sm text-center text-muted-foreground`}>
				Get the 6-character code from a friend
			</p>
			<div className={`flex flex-col gap-4 mt-6 mx-auto`}>
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
							aria-invalid={validatedCode && roomCode.length < 1}
						/>
						<InputOTPSlot
							index={1}
							aria-invalid={validatedCode && roomCode.length < 2}
						/>
						<InputOTPSlot
							index={2}
							aria-invalid={validatedCode && roomCode.length < 3}
						/>
					</InputOTPGroup>
					<InputOTPSeparator />
					<InputOTPGroup>
						<InputOTPSlot
							index={3}
							aria-invalid={validatedCode && roomCode.length < 4}
						/>
						<InputOTPSlot
							index={4}
							aria-invalid={validatedCode && roomCode.length < 5}
						/>
						<InputOTPSlot
							index={5}
							aria-invalid={validatedCode && roomCode.length < 6}
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
			</div>
		</div>
	);
}

function CreateRoom() {
	const navigate = useNavigate();
	const { mutate: createRoom, isPending: isLoading } = useCreateRoom();
	const [roomName, setRoomName] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);

	const handleCreateRoom = async () => {
		setError(null);
		if (!roomName.trim()) {
			setError("Room name cannot be empty.");
			return;
		}

		createRoom(
			{ roomName },
			{
				onSuccess: (newRoom) => {
					navigate(`/rooms/${newRoom.code}`);
				},
				onError: (error) => {
					setError(
						error.message ||
							"An error occurred while creating the room.",
					);
				},
			},
		);
	};
	return (
		<div className={`flex flex-col mt-4 border-2 p-8 rounded-lg`}>
			<h2 className={`text-center text-xl font-semibold`}>
				Create a New Room
			</h2>
			<p className={`text-sm text-center text-muted-foreground`}>
				Invite friends with a unique code
			</p>
			<Input
				placeholder='Room Name'
				className={`mt-6`}
				value={roomName}
				onChange={(e) => setRoomName(e.target.value)}
			/>
			{error && (
				<p
					className={`text-destructive text-sm mt-2 flex items-center gap-2`}
				>
					<TriangleAlert className={`w-4 h-4`} />
					{error}
				</p>
			)}
			<div className={`flex flex-col gap-4 mt-6 w-full mx-auto`}>
				<Button
					variant={"linear"}
					size='lg'
					onClick={handleCreateRoom}
					disabled={isLoading}
				>
					{isLoading && <Spinner />}
					Create room
				</Button>
			</div>
		</div>
	);
}
