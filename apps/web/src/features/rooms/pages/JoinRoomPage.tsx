import { usePlayer } from "@/features/home";
import { useJoinRoom, useRoom } from "@/features/rooms/hooks/room";
import { Badge, Button, Loading, Spinner } from "@/shared/ui";
import { ChevronLeftIcon, UsersIcon, ZapIcon } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

export function JoinRoomPage() {
	const navigate = useNavigate();
	const { roomCode } = useParams<{ roomCode: string }>();
	const { data: player, isPending: isPlayerLoading } = usePlayer();
	const { data: room, isPending: isRoomLoading, isError } = useRoom(roomCode);
	const { mutate: joinRoom, isPending: isJoining } = useJoinRoom();

	if (isPlayerLoading || isRoomLoading) {
		return (
			<div className='flex items-center justify-center h-dvh'>
				<Loading className='size-10 text-primary' />
			</div>
		);
	}

	if (!player) {
		return <Navigate to='/create-player' replace />;
	}

	if (!room || isError || room.code !== roomCode) {
		return <Navigate to='/404' replace />;
	}

	const isMember = room.members.some((member) => member.player_id === player.id);

	if (isMember) {
		return <Navigate to={`/rooms/${room.code}`} replace />;
	}

	const organizerName =
		room.members.find((member) => member.is_organizer)?.player.username ??
		"Unknown";
	const memberCount = room.member_count ?? room.members.length;
	const predictionCount = room.active_prediction_count ?? 0;

	const handleJoinRoom = () => {
		joinRoom(
			{ roomCode: room.code },
			{
				onSuccess: (joinedRoom) => {
					toast.success("Joined room successfully.");
					navigate(`/rooms/${joinedRoom.code}`, { replace: true });
				},
				onError: (error) => {
					toast.error("Failed to join room.", {
						description: error.message,
					});
				},
			},
		);
	};

	const handleBack = () => {
		if (globalThis.history.length > 1) {
			navigate(-1);
			return;
		}

		navigate("/", { replace: true });
	};

	return (
		<div className='min-h-dvh flex flex-col'>
			<header className='p-4 sticky top-0 left-0 right-0 z-10 bg-secondary/30 backdrop-blur-sm border-b'>
				<div className='max-w-280 mx-auto flex items-center gap-3'>
					<Button variant='linear' className='rounded-lg' onClick={handleBack}>
						<ChevronLeftIcon />
					</Button>
					<h1 className='font-bold truncate'>{room.name}</h1>
				</div>
			</header>

			<main className='max-w-280 w-full mx-auto flex-1 px-4 pt-4 pb-28'>
				<div className='border rounded-xl overflow-hidden bg-card'>
					<div className='h-36 bg-linear-to-r from-primary/30 via-accent/20 to-primary/10 flex items-center justify-center border-b'>
						<div className='size-14 rounded-full bg-background/90 text-2xl font-bold flex items-center justify-center'>
							{room.name.slice(0, 1).toUpperCase()}
						</div>
					</div>

					<div className='p-4 space-y-3'>
						<div className='flex items-start justify-between gap-3'>
							<div>
								<h2 className='text-xl font-semibold'>{room.name}</h2>
								<p className='text-sm text-muted-foreground'>
									Join this room to make predictions with other members.
								</p>
							</div>
							<Badge variant='secondary' className='rounded-md'>
								Public
							</Badge>
						</div>

						<div className='flex items-center gap-4 text-sm text-muted-foreground'>
							<div className='flex items-center gap-1'>
								<UsersIcon className='w-4 h-4' />
								<span>{memberCount} members</span>
							</div>
							<div className='flex items-center gap-1 text-primary'>
								<ZapIcon className='w-4 h-4' />
								<span>{predictionCount} live</span>
							</div>
						</div>

						<div className='grid gap-2 text-sm'>
							<div className='flex justify-between gap-4'>
								<span className='text-muted-foreground'>Created by</span>
								<span className='font-medium truncate'>{organizerName}</span>
							</div>
							<div className='flex justify-between gap-4'>
								<span className='text-muted-foreground'>Room code</span>
								<span className='font-medium'>{room.code}</span>
							</div>
						</div>
					</div>
				</div>
			</main>

			<div className='fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 p-4 backdrop-blur-xl'>
				<div className='max-w-280 mx-auto'>
					<Button
						variant='linear'
						size='lg'
						className='w-full'
						onClick={handleJoinRoom}
						disabled={isJoining}
					>
						{isJoining && <Spinner />}
						Join Room
					</Button>
				</div>
			</div>
		</div>
	);
}
