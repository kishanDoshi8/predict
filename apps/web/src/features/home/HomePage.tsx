import Home from "@/features/home/components/Home";
import { joinRoom } from "@/shared/lib/api";
import { roomKeys } from "@/shared/constants/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePlayer } from "@/features/home";
import { useWeeklyClaim } from "@/features/home";
import { Loading } from "@/shared/ui";

export function HomePage() {
	const navigate = useNavigate();
	const { data: player, isPending: isPlayerLoading } = usePlayer();
	const { mutate: claimWeeklyPoints } = useWeeklyClaim();
	const queryClient = useQueryClient();

	const [roomCode, setRoomCode] = React.useState("");
	const [validatedCode, setValidatedCode] = React.useState(false);

	const [isLoading, setIsLoading] = React.useState(false);

	useEffect(() => {
		if (!isPlayerLoading && !player) {
			navigate("/create-player", { replace: true });
		} else if (player) {
			claimWeeklyPoints();
		}
	}, [player, isPlayerLoading, claimWeeklyPoints, navigate]);

	useEffect(() => {
		if (roomCode.length === 6) {
			handleEnterRoom();
		}
	}, [roomCode]);

	const handleEnterRoom = async () => {
		if (roomCode.length === 6) {
			setIsLoading(true);
			try {
				const room = await queryClient.fetchQuery({
					queryKey: roomKeys.byCode(roomCode),
					queryFn: () => joinRoom(roomCode),
				});
				navigate(`/rooms/${room.code}`);
			} catch (error) {
				toast("Failed to enter room.", {
					description: (error as Error).message,
				});
				setValidatedCode(true); // Set validation state to true if code is invalid
			} finally {
				setIsLoading(false);
			}
		} else {
			setValidatedCode(true); // Set validation state to true if code is invalid
		}
	};

	if (isPlayerLoading) {
		return (
			<div className='flex items-center justify-center h-dvh'>
				<Loading className={`size-10 text-primary`} />
			</div>
		);
	}

	return (
		<Home
			roomCode={roomCode}
			setRoomCode={setRoomCode}
			validatedCode={validatedCode}
			setValidatedCode={setValidatedCode}
			isLoading={isLoading}
			handleEnterRoom={handleEnterRoom}
		/>
	);
}
