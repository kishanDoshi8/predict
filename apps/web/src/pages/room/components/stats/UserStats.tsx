import {
	Badge,
	Skeleton,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components";
import {
	Calendar1Icon,
	CrownIcon,
	FlameIcon,
	TargetIcon,
	TrophyIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRoomContext } from "../../RoomLayout";
import { usePlayer } from "@/store/player";
import {
	useRoomLeaderboard,
	useRoomWeeklyLeaderboard,
} from "@/store/leaderboard";
import { LeaderboardEntry } from "@/types";
import { twColor } from "@/lib/utils";

type LeaderboardTab = "this_week" | "all_time";

function UserStats() {
	const { room } = useRoomContext();
	const [activeLeaderboardTab, setActiveLeaderboardTab] =
		useState<LeaderboardTab>("this_week");

	const {
		data: allTimeLeaderboard = [],
		isPending: isAllTimeLeaderboardLoading,
	} = useRoomLeaderboard(room.id, activeLeaderboardTab === "all_time");

	const {
		data: weeklyLeaderboard = [],
		isPending: isWeeklyLeaderboardLoading,
	} = useRoomWeeklyLeaderboard(room.id, activeLeaderboardTab === "this_week");

	const handleOnTabChange = (value: string) => {
		setActiveLeaderboardTab(value as LeaderboardTab);
	};

	return (
		<div className={`w-full max-w-md mx-auto`}>
			<h2 className={`text-lg font-semibold`}>The Hall of Fame</h2>
			<p className={`text-xs text-muted-foreground mb-4`}>
				Where legends are made (and egos are crushed)
			</p>
			<Tabs defaultValue='this_week' onValueChange={handleOnTabChange}>
				<TabsList className={`w-full`}>
					<TabsTrigger value='this_week'>
						<Calendar1Icon /> This Week
					</TabsTrigger>
					<TabsTrigger value='all_time'>
						<TrophyIcon /> All Time
					</TabsTrigger>
				</TabsList>
				<TabsContent value='this_week'>
					<LeaderboardContent
						leaderboard={weeklyLeaderboard}
						isLoading={isWeeklyLeaderboardLoading}
					/>
				</TabsContent>
				<TabsContent value='all_time'>
					<LeaderboardContent
						leaderboard={allTimeLeaderboard}
						isLoading={isAllTimeLeaderboardLoading}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function LeaderboardContent({
	leaderboard,
	isLoading,
}: Readonly<{ leaderboard: LeaderboardEntry[]; isLoading: boolean }>) {
	const { data: player } = usePlayer();
	const [leaderboardPlayer, setLeaderboardPlayer] =
		useState<LeaderboardEntry | null>(null);
	const [gapToNextPlayer, setGapToNextPlayer] =
		useState<LeaderboardEntry | null>(null);

	useEffect(() => {
		if (leaderboard.length > 0 && player) {
			const leaderboardPlayer =
				leaderboard.find((entry) => entry.player_id === player.id) ||
				null;
			setLeaderboardPlayer(leaderboardPlayer);

			if (leaderboardPlayer && leaderboardPlayer.rank !== 1) {
				const nextPlayer = leaderboard
					.filter(
						(entry) =>
							entry.rank < leaderboardPlayer.rank &&
							entry.total_won_in_room >
								leaderboardPlayer.total_won_in_room,
					)
					.reduce<LeaderboardEntry | null>((closest, entry) => {
						if (!closest || entry.rank > closest.rank) {
							return entry;
						}

						return closest;
					}, null);
				console.log(
					"Player rank: ",
					leaderboardPlayer.rank,
					" Next rank: ",
					nextPlayer?.rank,
				);
				setGapToNextPlayer(nextPlayer);
			} else {
				setGapToNextPlayer(null);
			}
		} else {
			setLeaderboardPlayer(null);
			setGapToNextPlayer(null);
		}
	}, [leaderboard, player]);

	return (
		<div className={`flex flex-col gap-4`}>
			<div
				className={`text-card-foreground flex flex-col gap-6 rounded-xl border shadow-sm relative overflow-hidden border-border bg-linear-to-br from-card to-rose-500/5 p-5 mt-3`}
			>
				<div className={`flex gap-4 items-center`}>
					{isLoading ? (
						<Skeleton
							className={`w-14 h-14 rounded-lg bg-secondary animate-pulse`}
						/>
					) : (
						<div
							className={`relative w-14 h-14 flex items-center justify-center rounded-lg font-bold text-foreground text-2xl ${leaderboardPlayer?.rank === 1 ? "bg-rank-1 text-secondary" : "bg-linear-to-r from-primary to-accent"}`}
						>
							#{leaderboardPlayer?.rank ?? 0}
							{leaderboardPlayer?.rank === 1 && (
								<span>
									<CrownIcon
										className={`w-6 h-6 text-rank-1 absolute -top-2 border border-rank-1 -right-2 bg-background rounded-full p-1`}
									/>
								</span>
							)}
						</div>
					)}

					{isLoading ? (
						<div className={`flex-1`}>
							<Skeleton
								className={`w-1/2 h-4 rounded-lg bg-secondary animate-pulse mb-2`}
							/>
							<Skeleton
								className={`w-1/2 h-8 rounded-lg bg-secondary animate-pulse`}
							/>
						</div>
					) : (
						<div className={`flex-1`}>
							<p className={`text-xs`}>YOUR POINTS</p>
							<p className={`text-3xl font-extrabold`}>
								{(
									leaderboardPlayer?.total_won_in_room ?? 0
								).toLocaleString()}
							</p>
						</div>
					)}

					{isLoading ? (
						<Skeleton
							className={`w-20 h-10 rounded-lg bg-secondary animate-pulse`}
						/>
					) : (
						<>
							{leaderboardPlayer &&
								gapToNextPlayer &&
								gapToNextPlayer.total_won_in_room > 0 && (
									<div>
										<p
											className={`text-xs justify-end flex items-center gap-1 text-muted-foreground`}
										>
											GAP TO #{gapToNextPlayer.rank}
										</p>
										<p
											className={`text-lg font-bold justify-end flex items-center gap-1 text-accent`}
										>
											+
											{(
												gapToNextPlayer.total_won_in_room -
												leaderboardPlayer.total_won_in_room
											).toLocaleString()}
										</p>
									</div>
								)}
						</>
					)}
				</div>

				{isLoading ? (
					<div className={`flex flex-col gap-2`}>
						{[1, 2, 3, 4].map((i) => (
							<div
								key={i}
								className={`flex items-center gap-3 p-3 rounded-lg bg-secondary/60 animate-pulse`}
							>
								<Skeleton
									className={`w-6 h-6 text-sm font-bold rounded-md bg-secondary animate-pulse`}
								/>
								<Skeleton
									className={`w-1/4 h-4 rounded-lg bg-secondary animate-pulse`}
								/>
								<Skeleton
									className={`ml-auto w-10 h-4 rounded-lg bg-secondary animate-pulse`}
								/>
							</div>
						))}
					</div>
				) : (
					<div className={`flex flex-col gap-2`}>
						{leaderboard.slice(0, 4).map((entry) => {
							let backgroundColor: string;
							let color: string;

							if (entry.rank === 1) {
								backgroundColor = twColor("rank-1", 0.1);
								color = twColor("rank-1");
							} else if (entry.rank === 2) {
								backgroundColor = twColor("rank-2", 0.2);
								color = twColor("foreground");
							} else if (entry.rank === 3) {
								backgroundColor = twColor("rank-3", 0.2);
								color = twColor("rank-3");
							} else {
								backgroundColor = twColor("foreground", 0.001);
								color = twColor("foreground");
							}

							return (
								<div
									key={entry.player_id}
									className={`flex items-center gap-3 p-3 rounded-lg ${entry.player_id === player?.id ? "bg-linear-30 from-accent/10 border to-primary/10" : "bg-secondary/60"}`}
								>
									<p
										className={`w-6 h-6 text-sm font-bold rounded-md flex items-center justify-center`}
										style={{
											backgroundColor,
											color,
										}}
									>
										{entry.rank}
									</p>
									<p className={`font-medium`}>
										{entry.username}
										{entry.current_streak >= 3 && (
											<div className={`inline-block`}>
												<Badge
													className={`flex gap-0 items-center justify-center bg-accent/20 text-accent text-xs ml-2`}
												>
													<FlameIcon
														className={`w-2 h-2 text-rank-3`}
													/>
													{entry.current_streak}
												</Badge>
											</div>
										)}
										{entry.player_id === player?.id && (
											<Badge
												variant='outline'
												className={`ml-3 text-xs rounded-md`}
											>
												You
											</Badge>
										)}
									</p>
									<p className={`ml-auto font-bold`}>
										{(
											entry.total_won_in_room ?? 0
										).toLocaleString()}
									</p>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{isLoading ? (
				<div className={`flex gap-2`}>
					{[1, 2, 3].map((i) => (
						<Skeleton
							key={i}
							className={`flex-1 w-full h-24 rounded-lg bg-secondary animate-pulse`}
						/>
					))}
				</div>
			) : (
				<div className={`flex gap-2`}>
					<StatTile
						icon={<TrophyIcon className={`w-4 h-4 text-rank-1`} />}
						value={leaderboardPlayer?.winning_bets ?? 0}
						label='WINS'
					/>
					<StatTile
						icon={<TargetIcon className={`w-4 h-4 text-loss`} />}
						value={`${Math.round(leaderboardPlayer?.win_percentage ?? 0)}%`}
						label='ACCURACY'
					/>
					<StatTile
						icon={<FlameIcon className={`w-4 h-4 text-rank-3`} />}
						value={leaderboardPlayer?.current_streak ?? 0}
						label='STREAK'
					/>
				</div>
			)}
		</div>
	);
}

function StatTile({
	icon: Icon,
	value,
	label,
}: Readonly<{ icon: React.ReactNode; value: string | number; label: string }>) {
	return (
		<div
			className={`flex flex-col bg-card p-3 rounded-lg border flex-1 items-center `}
		>
			{Icon}
			<p className={`text-2xl font-bold mt-1`}>{value}</p>
			<p className={`text-[10px]`}>{label}</p>
		</div>
	);
}

export default UserStats;
