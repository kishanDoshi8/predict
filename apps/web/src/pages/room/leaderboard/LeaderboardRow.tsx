import { LeaderboardEntry } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CoinsIcon, FlameIcon, TriangleIcon, ZapIcon } from "lucide-react";
import { Badge } from "@/components";
import { LeaderboardSortBy } from "@/store/leaderboard";

type Props = {
	entry: LeaderboardEntry;
	currentPlayerId: string;
	sortBy: LeaderboardSortBy;
	onClick?: (playerId: string) => void;
};

export function LeaderboardRow({
	entry,
	currentPlayerId,
	sortBy,
	onClick,
}: Readonly<Props>) {
	const isSelf = entry.player_id === currentPlayerId;
	const initials = entry.username.slice(0, 2).toUpperCase();
	const isRatingsView = sortBy === "ratings";

	let rankLabel: string;
	if (entry.rank === 1) {
		rankLabel = "🥇";
	} else if (entry.rank === 2) {
		rankLabel = "🥈";
	} else if (entry.rank === 3) {
		rankLabel = "🥉";
	} else {
		rankLabel = `#${entry.rank}`;
	}

	return (
		<div
			className={cn(
				"flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors",
				isSelf
					? "border-win/30 bg-win/5"
					: "border-transparent hover:bg-accent/25",
				onClick && "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
			)}
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
			onClick={() => onClick?.(entry.player_id)}
			onKeyDown={(event) => {
				if (!onClick) return;
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onClick(entry.player_id);
				}
			}}
		>
			{/* Rank */}
			<span className='w-8 text-center text-sm text-muted-foreground shrink-0 tabular-nums'>
				{rankLabel}
			</span>

			{/* Avatar */}
			<Avatar size='default' className={cn(isSelf && "ring-1 ring-win")}>
				<AvatarFallback className='text-xs'>{initials}</AvatarFallback>
			</Avatar>

			{/* Name + badges */}
			<div className='flex-1 min-w-0'>
				<p
					className={cn(
						" font-medium truncate",
						isSelf && "text-win",
					)}
				>
					{entry.username}
					{isSelf && (
						<span className='ml-1 text-xs text-muted-foreground font-normal'>
							(You)
						</span>
					)}
					{entry.current_streak >= 3 && (
						<div className={`inline-block`}>
							<Badge
								className={`flex gap-0 items-center justify-center bg-accent/20 text-accent text-xs ml-2`}
							>
								<FlameIcon className={`w-2 h-2 text-rank-3`} />
								{entry.current_streak}
							</Badge>
						</div>
					)}
				</p>
				<p className={`flex gap-4 items-center`}>
					{entry.total_revealed_bets > 0 && (
						<p className='text-xs text-muted-foreground tabular-nums'>
							{entry.winning_bets}/{entry.total_revealed_bets}{" "}
							wins
						</p>
					)}
					{entry.rank_change !== null && entry.rank_change < 0 && (
						<p className='flex items-center text-xs text-loss tabular-nums'>
							<TriangleIcon
								className={`w-3 h-3 inline-block mr-1 rotate-180`}
							/>
							{Math.abs(entry.rank_change)}
						</p>
					)}
					{entry.rank_change !== null && entry.rank_change > 0 && (
						<p className='flex items-center text-xs text-win tabular-nums'>
							<TriangleIcon
								className={`w-3 h-3 inline-block mr-1`}
							/>
							{Math.abs(entry.rank_change)}
						</p>
					)}
				</p>
			</div>

			{/* Stats */}
			<div className='flex flex-col items-end gap-0.5 shrink-0 text-right'>
				{isRatingsView ? (
					<>
						<p className='flex items-center font-semibold tabular-nums'>
							<ZapIcon className='w-4 h-4 text-cyan-500 inline-block mr-0.5' />
							{entry.prediction_rating}
						</p>
						<p className='text-xs text-muted-foreground tabular-nums'>
							{entry.total_won_in_room.toLocaleString()} pts
						</p>
					</>
				) : (
					<>
						<p className='font-semibold tabular-nums'>
							<CoinsIcon className='w-4 h-4 text-yellow-400 inline-block mr-0.5' />
							{entry.total_won_in_room.toLocaleString()}
						</p>
						<p className='flex items-center text-xs text-muted-foreground tabular-nums'>
							{entry.prediction_rating} PR
						</p>
					</>
				)}
			</div>
		</div>
	);
}
