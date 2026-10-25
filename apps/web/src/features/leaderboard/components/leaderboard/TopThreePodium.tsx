import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib/utils";

// What each podium spot shows; callers decide (series balance or overall profit).
export type PodiumEntry = {
	player_id: string;
	username: string;
	rank: number;
	primary: string;
	secondary: string;
};

type Props = {
	top: PodiumEntry[];
	currentPlayerId: string;
};

const MEDALS = ["🥇", "🥈", "🥉"] as const;

const podiumOrder = [1, 0, 2]; // visually: 2nd | 1st | 3rd

export function TopThreePodium({
	top,
	currentPlayerId,
}: Readonly<Props>) {
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
									? "ring-rank-1 size-14"
									: "ring-muted size-10",
								isSelf && "ring-win",
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
								"text-center font-medium leading-tight max-w-24 truncate text-sm",
								isSelf && "text-win",
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
							{entry.primary}
						</p>
						<p className='text-[10px] text-muted-foreground tabular-nums'>
							{entry.secondary}
						</p>

						{(() => {
							let podiumClass = "";
							if (isFirst) {
								podiumClass =
									"bg-rank-1/15 min-h-[3rem]";
							} else if (visualRank === 2) {
								podiumClass = "bg-muted/50 min-h-8";
							} else {
								podiumClass = "bg-muted/30 min-h-6";
							}
							return (
								<div
									className={cn(
										"w-full rounded-t-md flex items-center justify-center",
										podiumClass,
									)}
								/>
							);
						})()}
					</div>
				);
			})}
		</div>
	);
}
