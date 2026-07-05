import {
	Outlet,
	useMatches,
	useNavigate,
	useOutletContext,
	useParams,
} from "react-router-dom";
import { useRoom } from "@/entities/room/hooks/room";
import { Room } from "@/entities";
import { RoomHeader } from "./components/RoomHeader";
import { useEffect, useState } from "react";
import { usePlayer } from "@/entities/player/hooks/player";
import { useWeeklyClaim } from "@/entities/player/hooks/useWeeklyClaim";
import { usePreferences, useMarkHowToPlaySeen } from "@/entities/player/hooks/preferences";
import HowToPlayModal from "@/shared/ui/HowToPlayModal";
import { Loading } from "@/shared/ui";
import { useRoomRealtime } from "@/entities/room/hooks/useRoomRealtime";

export default function RoomLayout() {
	const navigate = useNavigate();
	const matches = useMatches();
	const activeMatch = matches[matches.length - 1];
	const { data: player, isPending: isPlayerLoading } = usePlayer();
	const { roomCode } = useParams<{ roomCode: string }>();
	const { data: room, isPending, isError } = useRoom(roomCode);
	const headerConfig = (activeMatch?.handle as RoomRouteHandle | undefined)
		?.header;

	useRoomRealtime(room?.id ?? null);

	const { mutate: claimWeeklyReward } = useWeeklyClaim();
	const roomId = room?.id ?? "";
	const { data: preferences } = usePreferences(roomId);
	const { mutate: markSeen } = useMarkHowToPlaySeen(roomId || undefined);
	const [showHowToPlay, setShowHowToPlay] = useState(false);

	useEffect(() => {
		if (player) {
			claimWeeklyReward();
		}

		if (!isPlayerLoading && !player) {
			navigate("/create-player", { replace: true });
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
				<Loading className={`size-10 text-primary`} />
			</div>
		);
	}

	if (!room || isError || room.code !== roomCode) {
		navigate("/404", { replace: true });
		return null;
	}

	const handleHeaderLeftAction = () => {
		const leftAction = headerConfig?.leftAction ?? "home";

		if (leftAction === "none") {
			return;
		}

		if (leftAction === "home") {
			navigate(`/`, { replace: true });
			return;
		}

		if (window.history.length > 1) {
			navigate(-1);
			return;
		}

		navigate(`/rooms/${room.code}`, { replace: true });
	};

	return (
		<div className='min-h-dvh flex flex-col'>
			<RoomHeader
				room={room}
				leftAction={headerConfig?.leftAction ?? "home"}
				title={headerConfig?.title}
				onLeftAction={handleHeaderLeftAction}
			/>

			<main className='max-w-280 w-full mx-auto flex-1 flex flex-col'>
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

type RoomHeaderHandle = {
	leftAction: "home" | "back" | "none";
	title?: string;
};

type RoomRouteHandle = {
	header?: RoomHeaderHandle;
};

export const useRoomContext = () => {
	const context = useOutletContext<RoomOutletContext>();
	if (!context) {
		throw new Error("useRoomContext must be used within a RoomLayout");
	}
	return context;
};
