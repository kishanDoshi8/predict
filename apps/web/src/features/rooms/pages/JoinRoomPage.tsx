import { usePlayer } from "@/features/home";
import { useJoinRoom, useRoom } from "@/features/rooms/hooks/room";
import { Button, Loading, Spinner } from "@/shared/ui";
import { ChevronLeftIcon } from "lucide-react";
import { receipt } from "@/features/share";
import { TornEdge } from "@/features/share/components/Slip";
import { Navigate, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { savePostAuthRedirect } from "@/shared/lib/postAuthRedirect";

export function JoinRoomPage() {
	const navigate = useNavigate();
	const { roomCode } = useParams<{ roomCode: string }>();
	const location = useLocation();
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
		// New here: pick a name first, then come straight back to this room.
		savePostAuthRedirect(`${location.pathname}${location.search}`);
		return <Navigate to='/create-player' replace />;
	}

	if (!room || isError || room.code !== roomCode) {
		return <Navigate to='/404' replace />;
	}

	// Only paths inside this room, so a crafted link can't send people elsewhere.
	const requestedNext = new URLSearchParams(location.search).get("next");
	const destination =
		requestedNext?.startsWith(`/rooms/${room.code}/`) && !requestedNext.includes("//")
			? requestedNext
			: `/rooms/${room.code}`;

	const isMember = room.members.some((member) => member.player_id === player.id);

	if (isMember) {
		return <Navigate to={destination} replace />;
	}

	const organizerName =
		room.organizer_username ??
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
					navigate(
						joinedRoom.code === room.code ? destination : `/rooms/${joinedRoom.code}`,
						{ replace: true },
					);
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

	const leaders: Array<[string, string]> = [
		["Friends playing", memberCount.toLocaleString()],
		["Predictions live", predictionCount.toLocaleString()],
		["Organized by", organizerName],
		["Room code", room.code],
	];

	return (
		<div className='min-h-dvh flex flex-col'>
			<header className='p-4'>
				<Button
					variant='ghost'
					size='icon'
					className='rounded-lg'
					onClick={handleBack}
					aria-label='Back'
				>
					<ChevronLeftIcon />
				</Button>
			</header>

			<main className='flex-1 w-full max-w-md mx-auto flex flex-col justify-center px-6 pb-32'>
				{/* An admission ticket, in the same print as the shared cards. */}
				<div
					className='-rotate-1 drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)]'
					style={{ fontFamily: receipt.mono, color: receipt.print }}
				>
					<div
						className='flex flex-col gap-5 px-6 pt-6 pb-5'
						style={{ background: receipt.paper }}
					>
						<div className='flex justify-between gap-4 text-sm'>
							<span className='font-bold'>Verdict</span>
							<span className='font-semibold'>Admit one</span>
						</div>
						<div
							className='border-t-2 border-dashed'
							style={{ borderColor: receipt.faded }}
						/>
						<div>
							<p className='text-sm font-bold'>You're invited to</p>
							<h1
								className='mt-1 text-6xl font-extrabold leading-[0.95] wrap-anywhere'
								style={{ fontFamily: receipt.display, color: receipt.brand }}
							>
								{room.name}
							</h1>
						</div>
						<dl className='flex flex-col gap-2 text-sm'>
							{leaders.map(([label, value]) => (
								<div key={label} className='flex items-baseline gap-2'>
									<dt className='whitespace-nowrap'>{label}</dt>
									<span
										aria-hidden='true'
										className='flex-1 -translate-y-1 border-b-2 border-dotted opacity-60'
										style={{ borderColor: receipt.faded }}
									/>
									<dd className='truncate font-bold'>{value}</dd>
								</div>
							))}
						</dl>
						<p className='text-xs' style={{ color: receipt.faded }}>
							Same points for everyone. Top balance when the series ends
							takes the title.
						</p>
					</div>
					<TornEdge height={10} teeth={24} />
				</div>
			</main>

			<div className='fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 p-4 backdrop-blur-xl'>
				<div className='max-w-md mx-auto'>
					<Button
						variant='linear'
						size='lg'
						className='w-full'
						onClick={handleJoinRoom}
						disabled={isJoining}
					>
						{isJoining && <Spinner />}
						Join {room.name}
					</Button>
				</div>
			</div>
		</div>
	);
}
