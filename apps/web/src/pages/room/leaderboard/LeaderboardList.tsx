import { Skeleton } from "@/components/ui/skeleton";
import { LeaderboardEntry } from "@/types";
import { LeaderboardRow } from "./LeaderboardRow";

type Props = {
	entries: LeaderboardEntry[];
	currentPlayerId: string;
	isLoading: boolean;
	scope: "all_time" | "this_week";
};

export function LeaderboardList({
	entries,
	currentPlayerId,
	isLoading,
	scope,
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
					{scope === "this_week"
						? "No wins this week yet. Be the first to score."
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
					/>
				))}
			</div>
		</div>
	);
}
