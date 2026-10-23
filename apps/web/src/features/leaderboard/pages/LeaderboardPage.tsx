import { useRoomContext } from "@/app/layouts/RoomLayout";
import { usePlayer } from "@/features/home";
import {
	useSeriesLeaderboard,
	LeaderboardList,
	TopThreePodium,
} from "@/features/leaderboard";
import { SeriesSelector, useCurrentSeries } from "@/features/series";
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
	const { currentSeries, currentSeriesId, setCurrentSeriesId } =
		useCurrentSeries(room.id);
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
					<h2 className='text-lg font-semibold'>Standings</h2>
					<p className='text-sm text-muted-foreground'>
						{currentSeries?.status === "active"
							? "Top balance when the series closes wins the title."
							: "Final standings."}
					</p>
				</div>
				<Link
					to={`/rooms/${room.code}/series`}
					className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0'
				>
					<TrophyIcon className='h-4 w-4' />
					Past champions
				</Link>
			</div>

			<div className='flex flex-col gap-3'>
				<SeriesSelector
					roomId={room.id}
					mode='all'
					value={currentSeriesId}
					onValueChange={setCurrentSeriesId}
					placeholder='Select series'
					emptyMessage='No series yet.'
				/>

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
