import { useRoomContext } from "@/app/layouts/RoomLayout";
import { usePlayer } from "@/features/home";
import {
	useSeriesLeaderboard,
	LeaderboardList,
	TopThreePodium,
} from "@/features/leaderboard";
import { useCurrentSeries } from "@/features/series";
import { TrophyIcon } from "lucide-react";
import React, { Suspense, lazy } from "react";
import { Link } from "react-router-dom";

const PlayerProfileDialog = lazy(() =>
	import("@/features/leaderboard/components/player/PlayerProfileDialog").then(
		(module) => ({ default: module.PlayerProfileDialog }),
	),
);

export function LeaderboardPage() {
	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const { currentSeries, currentSeriesId } = useCurrentSeries(room.id);
	const [selectedPlayerId, setSelectedPlayerId] = React.useState<
		string | null
	>(null);
	const [isProfileDialogOpen, setIsProfileDialogOpen] = React.useState(false);

	const { data: leaderboard = [], isPending: isLeaderboardLoading } =
		useSeriesLeaderboard(room.id, currentSeriesId);

	return (
		<div className='flex flex-col gap-4 p-4 max-w-lg mx-auto w-full'>
			{/* Section heading */}
			<div className='flex items-start justify-between gap-3'>
				<div>
					<h2 className='text-lg font-semibold'>
						{currentSeries?.title ?? "Standings"}
					</h2>
					<p className='text-sm text-muted-foreground'>
						{currentSeries?.status === "active"
							? "Top balance when the series closes wins the title."
							: currentSeries
								? "Final standings."
								: "Standings appear once a series starts."}
					</p>
				</div>
			</div>

			<div className='flex flex-col gap-3'>
				<TopThreePodium
					top={currentSeriesId ? leaderboard.slice(0, 3) : []}
					currentPlayerId={player?.id ?? ""}
				/>

				<LeaderboardList
					entries={currentSeriesId ? leaderboard : []}
					currentPlayerId={player?.id ?? ""}
					isLoading={!!currentSeriesId && isLeaderboardLoading}
					onRowClick={(playerId) => {
						setSelectedPlayerId(playerId);
						setIsProfileDialogOpen(true);
					}}
				/>
			</div>

			{isProfileDialogOpen ? (
				<Suspense fallback={null}>
					<PlayerProfileDialog
						roomId={room.id}
						playerId={selectedPlayerId}
						open={isProfileDialogOpen}
						onOpenChange={(open) => {
							setIsProfileDialogOpen(open);
							if (!open) setSelectedPlayerId(null);
						}}
					/>
				</Suspense>
			) : null}
		</div>
	);
}
