import { LeaderboardEntry } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
	top: LeaderboardEntry[];
	currentPlayerId: string;
};

const MEDALS = ["🥇", "🥈", "🥉"] as const;

const podiumOrder = [1, 0, 2]; // visually: 2nd | 1st | 3rd

export function TopThreePodium({ top, currentPlayerId }: Readonly<Props>) {
	if (top.length === 0) return null;

	const slots = podiumOrder.map((i) => top[i]).filter(Boolean);

	return (
		<div className='flex items-end justify-center gap-2 pt-4 pb-2'>
			{slots.map((entry) => {
				const visualRank = entry.rank; // 1, 2, or 3
				const isFirst = visualRank === 1;
				const isSelf = entry.player_id === currentPlayerId;
				const initials = entry.username.slice(0, 2).toUpperCase();

				return (
					<div
						key={entry.player_id}
						className={cn(
							"flex flex-col items-center gap-1 flex-1",
							isFirst && "order-first md:order-0",
						)}
					>
						<span className='text-xl'>
							{MEDALS[visualRank - 1]}
						</span>

						<Avatar
							size='lg'
							className={cn(
								"ring-2",
								isFirst
									? "ring-yellow-400 size-14"
									: "ring-muted size-10",
								isSelf && "ring-primary",
							)}
						>
							<AvatarFallback
								className={cn(
									isFirst
										? "text-base font-semibold"
										: "text-sm",
								)}
							>
								{initials}
							</AvatarFallback>
						</Avatar>

						<p
							className={cn(
								"text-center font-medium leading-tight max-w-[6rem] truncate text-sm",
								isSelf && "text-primary",
							)}
						>
							{entry.username}
							{isSelf && (
								<span className='ml-1 text-xs text-muted-foreground'>
									(You)
								</span>
							)}
						</p>

						<p
							className={cn(
								"text-xs tabular-nums",
								isFirst
									? "font-semibold"
									: "text-muted-foreground",
							)}
						>
							{entry.total_won_in_room.toLocaleString()} pts
						</p>

						<div
							className={cn(
								"w-full rounded-t-md flex items-center justify-center",
								isFirst
									? "bg-yellow-400/20 dark:bg-yellow-500/15 min-h-[3rem]"
									: visualRank === 2
										? "bg-muted/50 min-h-[2rem]"
										: "bg-muted/30 min-h-[1.5rem]",
							)}
						/>
					</div>
				);
			})}
		</div>
	);
}
