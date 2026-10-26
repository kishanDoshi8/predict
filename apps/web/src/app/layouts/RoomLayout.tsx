import {
	generatePath,
	Outlet,
	useMatches,
	useNavigate,
	useOutletContext,
	useParams,
} from "react-router-dom";
import {
	useRoom,
	Room,
	RoomPrefetcher,
	RoomSwitcherDrawer,
	useRoomRealtime,
} from "@/features/rooms";
import { RoomHeader } from "@/features/predictions";
import { Suspense, lazy, useEffect, useState } from "react";
import { usePlayer, useSetLastVisitedRoom } from "@/features/home";
import { usePreferences, useMarkHowToPlaySeen } from "@/features/preferences";
import { Loading } from "@/shared/ui";
import { useAppNavigation } from "@/shared/lib/navigation";

const HowToPlayModal = lazy(
	() => import("@/features/onboarding/components/HowToPlayModal"),
);

export default function RoomLayout() {
	const navigate = useNavigate();
	const { back } = useAppNavigation();
	const matches = useMatches();
	const activeMatch = matches.at(-1);
	const { data: player, isPending: isPlayerLoading } = usePlayer();
	const params = useParams();
	const { roomCode } = params as { roomCode?: string };
	const { data: room, isPending, isError } = useRoom(roomCode);
	const headerConfig = (activeMatch?.handle as RoomRouteHandle | undefined)
		?.header;

	useRoomRealtime(room?.id ?? null);

	const roomId = room?.id ?? "";
	const { data: preferences } = usePreferences(roomId);
	const { mutate: markSeen } = useMarkHowToPlaySeen(roomId || undefined);
	const { mutate: setLastVisitedRoom } = useSetLastVisitedRoom();
	const [showHowToPlay, setShowHowToPlay] = useState(false);
	const [showRoomSwitcher, setShowRoomSwitcher] = useState(false);

	useEffect(() => {
		if (!isPlayerLoading && !player) {
			navigate("/create-player", { replace: true });
		}
	}, [player, isPlayerLoading, navigate]);

	useEffect(() => {
		if (preferences && !preferences.has_seen_how_to_play) {
			setShowHowToPlay(true);
		}
	}, [preferences]);

	useEffect(() => {
		if (!room?.id || player?.last_visited_room_id === room.id) {
			return;
		}

		setLastVisitedRoom(room.id);
	}, [room?.id, player?.last_visited_room_id, setLastVisitedRoom]);

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
			setShowRoomSwitcher(true);
			return;
		}

		// Opened with nothing under it: go to the page it belongs to.
		const parent = headerConfig?.parent
			? `/rooms/${room.code}/${generatePath(headerConfig.parent, params)}`
			: `/rooms/${room.code}`;
		back(parent);
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
			<RoomPrefetcher roomId={room.id} />

			{player ? (
				<RoomSwitcherDrawer
					open={showRoomSwitcher}
					onOpenChange={setShowRoomSwitcher}
					playerId={player.id}
				/>
			) : null}

			{showHowToPlay ? (
				<Suspense fallback={null}>
					<HowToPlayModal
						open={showHowToPlay}
						onClose={handleHowToPlayClose}
					/>
				</Suspense>
			) : null}
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
	// Where Back goes when the page was opened from a link with nothing
	// under it, relative to the room (e.g. "series"). Defaults to Home.
	parent?: string;
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
