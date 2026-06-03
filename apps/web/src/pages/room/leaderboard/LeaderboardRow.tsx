import { LeaderboardEntry } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── badge derivation ────────────────────────────────────────────────────────
// Badges are derived purely from stats — nothing hardcoded per player.

type BadgeDef = {
	icon: string;
	label: string;
};

function deriveBadges(
	entry: LeaderboardEntry,
	all: LeaderboardEntry[],
): BadgeDef[] {
	const badges: BadgeDef[] = [];

	if (entry.rank === 1) {
		badges.push({ icon: "🥇", label: "Leader" });
	}

	if (entry.current_streak >= 4) {
		badges.push({ icon: "🔥", label: "Hot streak" });
	}

	if (entry.highest_streak >= 8) {
		badges.push({ icon: "🐐", label: "GOAT" });
	}

	if (entry.total_revealed_bets >= 5 && entry.win_percentage >= 65) {
		badges.push({ icon: "🎯", label: "Sharp" });
	}

	// Biggest net loser in the room
	const minNet = Math.min(...all.map((e) => e.net_points));
	if (minNet < 0 && entry.net_points === minNet && all.length > 1) {
		badges.push({ icon: "💀", label: "Biggest L" });
	}

	// Most bets placed (risk addict) — only if clearly more than average
	const maxBets = Math.max(...all.map((e) => e.total_bets));
	if (maxBets > 0 && entry.total_bets === maxBets && all.length > 1) {
		badges.push({ icon: "🎲", label: "Risk addict" });
	}

	return badges;
}

// ─── component ───────────────────────────────────────────────────────────────

type Props = {
	entry: LeaderboardEntry;
	all: LeaderboardEntry[];
	currentPlayerId: string;
};

export function LeaderboardRow({
	entry,
	all,
	currentPlayerId,
}: Readonly<Props>) {
	const isSelf = entry.player_id === currentPlayerId;
	const initials = entry.username.slice(0, 2).toUpperCase();
	const badges = deriveBadges(entry, all);

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

	if (entry.total_revealed_bets === 0) {
		// Don't show players with 0 revealed bets — keeps the board more meaningful and less noisy
		return null;
	}

	return (
		<div
			className={cn(
				"flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors",
				isSelf
					? "border-win/30 bg-win/5"
					: "border-transparent hover:bg-accent/50",
			)}
		>
			{/* Rank */}
			<span className='w-8 text-center text-sm text-muted-foreground shrink-0 tabular-nums'>
				{rankLabel}
			</span>

			{/* Avatar */}
			<Avatar size='sm' className={cn(isSelf && "ring-1 ring-win")}>
				<AvatarFallback className='text-xs'>{initials}</AvatarFallback>
			</Avatar>

			{/* Name + badges */}
			<div className='flex-1 min-w-0'>
				<p
					className={cn(
						"text-sm font-medium truncate",
						isSelf && "text-win",
					)}
				>
					{entry.username}
					{isSelf && (
						<span className='ml-1 text-xs text-muted-foreground font-normal'>
							(You)
						</span>
					)}
				</p>
				{badges.length > 0 && (
					<div className='flex flex-wrap gap-1 mt-0.5'>
						{badges.map((b) => (
							<Badge
								key={b.label}
								variant='secondary'
								className='text-xs py-0 px-1.5 h-4 leading-none'
							>
								{b.icon} {b.label}
							</Badge>
						))}
					</div>
				)}
			</div>

			{/* Stats */}
			<div className='flex flex-col items-end gap-0.5 shrink-0 text-right'>
				<p className='text-sm font-semibold tabular-nums'>
					{entry.total_won_in_room.toLocaleString()}
					<span className='text-xs font-normal text-muted-foreground ml-0.5'>
						pts
					</span>
				</p>
				{entry.total_revealed_bets > 0 && (
					<p className='text-xs text-muted-foreground tabular-nums'>
						{entry.winning_bets}/{entry.total_revealed_bets} wins
					</p>
				)}
			</div>
		</div>
	);
}
