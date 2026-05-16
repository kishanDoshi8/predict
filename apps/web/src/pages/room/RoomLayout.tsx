import {
	Outlet,
	useNavigate,
	useOutletContext,
	useParams,
} from "react-router-dom";
import { useRoom } from "@/store/room";
import { Room } from "@/types";
import { Spinner } from "@/components";
import { RoomHeader } from "./components/RoomHeader";
import { useEffect, useState } from "react";
import { usePlayer } from "@/store/player";
import { useWeeklyClaim } from "@/hooks/useWeeklyClaim";
import { usePreferences, useMarkHowToPlaySeen } from "@/store/preferences";
import HowToPlayModal from "@/components/HowToPlayModal";

export default function RoomLayout() {
	const navigate = useNavigate();
	const { data: player, isPending: isPlayerLoading } = usePlayer();
	const { roomCode } = useParams<{ roomCode: string }>();
	const { data: room, isPending, isError } = useRoom(roomCode);

	const { mutate: claimWeeklyReward } = useWeeklyClaim();
	const { data: preferences } = usePreferences(room?.id ?? "");
	const { mutate: markSeen } = useMarkHowToPlaySeen(room?.id);
	const [showHowToPlay, setShowHowToPlay] = useState(false);

	useEffect(() => {
		if (player) {
			claimWeeklyReward();
		}

		if (!isPlayerLoading && !player) {
			navigate("/create-player");
		}
	}, [player, isPlayerLoading, navigate]);

	useEffect(() => {
		if (preferences && !preferences.has_seen_how_to_play) {
			setShowHowToPlay(true);
		}
	}, [preferences]);

	const handleHowToPlayClose = () => {
		setShowHowToPlay(false);
		markSeen();
	};

	if (isPending || isPlayerLoading) {
		return (
			<div className='flex items-center justify-center h-dvh'>
				<Spinner className={`size-10 text-primary`} />
			</div>
		);
	}

	if (!room || isError || room.code !== roomCode) {
		navigate("/404", { replace: true });
		return null;
	}

	return (
		<div className='min-h-dvh flex flex-col'>
			<RoomHeader room={room} />

			<main className='px-4 max-w-280 w-full mx-auto flex-1 flex flex-col'>
				<Outlet context={{ room, roomCode }} />
			</main>

			<HowToPlayModal
				open={showHowToPlay}
				onClose={handleHowToPlayClose}
			/>
		</div>
	);
}

export type RoomOutletContext = {
	room: Room;
	roomCode: string;
};

export const useRoomContext = () => {
	const context = useOutletContext<RoomOutletContext>();
	if (!context) {
		throw new Error("useRoomContext must be used within a RoomLayout");
	}
	return context;
};
