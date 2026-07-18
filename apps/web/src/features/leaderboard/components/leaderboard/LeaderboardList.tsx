import { Skeleton } from "@/shared/ui/skeleton";
import { LeaderboardEntry } from "@/features/leaderboard";
import { LeaderboardRow } from "./LeaderboardRow";
import { LeaderboardSortBy } from "@/features/leaderboard";

type Props = {
	entries: LeaderboardEntry[];
	currentPlayerId: string;
	isLoading: boolean;
	scope: "all_time" | "series";
	sortBy: LeaderboardSortBy;
	onRowClick?: (playerId: string) => void;
};

export function LeaderboardList({
	entries,
	currentPlayerId,
	isLoading,
	scope,
	sortBy,
	onRowClick,
}: Readonly<Props>) {
	if (isLoading) {
		return (
			<div className='flex flex-col gap-2'>
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className='h-14 w-full rounded-xl' />
				))}
			</div>
		);
	}

	if (entries.length === 0) {
		return (
			<div className='flex flex-col items-center gap-2 py-12 text-center'>
				<p className='text-4xl'>🏆</p>
				<p className='text-muted-foreground text-sm'>
					{scope === "series"
						? "No series standings yet. Be the first to score."
						: "No one is on the board yet. Make a prediction!"}
				</p>
			</div>
		);
	}

	return (
		<div className='flex flex-col gap-2'>
			{/* Divider */}
			{entries.length > 3 && (
				<div className='my-1 border-t border-border/50' />
			)}

			<div className='flex flex-col gap-1'>
				{entries.map((entry) => (
					<LeaderboardRow
						key={entry.player_id}
						entry={entry}
						currentPlayerId={currentPlayerId}
						sortBy={sortBy}
						onClick={onRowClick}
					/>
				))}
			</div>
		</div>
	);
}
