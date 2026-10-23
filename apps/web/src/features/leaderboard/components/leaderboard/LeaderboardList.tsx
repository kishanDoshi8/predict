import { Skeleton } from "@/shared/ui/skeleton";
import { LeaderboardEntry } from "@/features/leaderboard";
import { LeaderboardRow } from "./LeaderboardRow";

type Props = {
	entries: LeaderboardEntry[];
	currentPlayerId: string;
	isLoading: boolean;
	onRowClick?: (playerId: string) => void;
};

export function LeaderboardList({
	entries,
	currentPlayerId,
	isLoading,
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
					No standings yet. They appear once a series starts.
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
						onClick={onRowClick}
					/>
				))}
			</div>
		</div>
	);
}
