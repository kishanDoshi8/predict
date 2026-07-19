import {
	Badge,
	FadeContent,
	Skeleton,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/ui";
import {
	ArrowDown10Icon,
	Calendar1Icon,
	ChevronRightIcon,
	CrosshairIcon,
	CrownIcon,
	FlameIcon,
	TrophyIcon,
} from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import { useRoomContext } from "@/app/layouts/RoomLayout";
import { usePlayer } from "@/features/home";
import {
	LeaderboardEntry,
	type SortByOption,
	useRoomLeaderboard,
	useSeriesLeaderboard,
} from "@/features/leaderboard";
import { SeriesSelector } from "@/features/series";
import { Room } from "@/features/rooms";
import { twColor } from "@/shared/lib/utils";
import { Link } from "react-router-dom";
import { useLocalStorage } from "@/shared/hooks/useLocalStorage";
import { localStorageKeys } from "@/shared/constants/queryKeys";

const PlayerProfileDialog = lazy(() =>
	import("@/features/leaderboard/components/player/PlayerProfileDialog").then(
		(module) => ({ default: module.PlayerProfileDialog }),
	),
);

type LeaderboardTab = "series" | "all_time";

type UserStatsProps = {
	showControls?: boolean;
	title?: string;
	subtitle?: string;
	leaderboardEntriesOverride?: LeaderboardEntry[];
	isLeaderboardLoadingOverride?: boolean;
	showSeeAllLink?: boolean;
};

function UserStats({
	showControls = true,
	title = "The Hall of Fame",
	subtitle = "Where legends are made (and egos are crushed)",
	leaderboardEntriesOverride,
	isLeaderboardLoadingOverride,
	showSeeAllLink = true,
}: Readonly<UserStatsProps>) {
	const { room } = useRoomContext();
	const [activeLeaderboardTab, setActiveLeaderboardTab] =
		useLocalStorage<string>(
			"series",
			localStorageKeys.userPreference.leaderboard.active_leaderboard_tab,
		);

	const normalizedLeaderboardTab: LeaderboardTab =
		activeLeaderboardTab === "all_time" ? "all_time" : "series";

	const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);

	const [sortBy, setSortBy] = useLocalStorage<SortByOption>(
		"ratings",
		localStorageKeys.userPreference.leaderboard.sort_by,
	);
	const effectiveTab: LeaderboardTab = showControls
		? normalizedLeaderboardTab
		: "all_time";

	const {
		data: allTimeLeaderboard = [],
		isPending: isAllTimeLeaderboardLoading,
	} = useRoomLeaderboard(room.id, effectiveTab === "all_time", sortBy);

	const { data: seriesLeaderboard = [], isPending: isSeriesLeaderboardLoading } =
		useSeriesLeaderboard(
			room.id,
			selectedSeriesId,
			effectiveTab === "series",
			sortBy,
		);

	const leaderboard =
		leaderboardEntriesOverride ??
		(effectiveTab === "all_time" ? allTimeLeaderboard : seriesLeaderboard);
	const isLeaderboardLoading =
		isLeaderboardLoadingOverride ??
		(effectiveTab === "all_time"
			? isAllTimeLeaderboardLoading
			: isSeriesLeaderboardLoading);

	useEffect(() => {
		if (activeLeaderboardTab === "this_week") {
			setActiveLeaderboardTab("series");
		}
	}, [activeLeaderboardTab, setActiveLeaderboardTab]);

	const handleOnTabChange = (value: string) => {
		setActiveLeaderboardTab(value as LeaderboardTab);
	};

	return (
		<div className={`w-full max-w-md mx-auto`}>
			<h2 className={`text-lg font-semibold`}>{title}</h2>
			<p className={`text-xs text-muted-foreground mb-4`}>{subtitle}</p>
			{showControls ? (
				<Tabs
					defaultValue={normalizedLeaderboardTab}
					onValueChange={handleOnTabChange}
				>
					<TabsList className={`w-full`}>
						<TabsTrigger value='series'>
							<Calendar1Icon /> Series
						</TabsTrigger>
						<TabsTrigger value='all_time'>
							<TrophyIcon /> All Time
						</TabsTrigger>
					</TabsList>
					{effectiveTab === "series" ? (
						<SeriesSelector
							roomId={room.id}
							mode='active-or-last'
							value={selectedSeriesId}
							onValueChange={setSelectedSeriesId}
							className='mt-2'
							placeholder='Select series'
							autoSelect
						/>
					) : null}
					{/* Sort by */}
					<div className={`flex gap-1 my-1 justify-end items-center`}>
						<ArrowDown10Icon
							className={`text-muted-foreground/70`}
						/>
						<ToggleGroup
							type='single'
							value={sortBy}
							onValueChange={(value) => {
								if (value !== "points" && value !== "ratings")
									return;
								setSortBy(value);
							}}
							variant={"outline"}
						>
							<ToggleGroupItem value='ratings'>
								Skill
							</ToggleGroupItem>
							<ToggleGroupItem value='points'>
								Wealth
							</ToggleGroupItem>
						</ToggleGroup>
					</div>
					<TabsContent value='series'>
						<LeaderboardContent
							leaderboard={seriesLeaderboard}
							isLoading={
								isSeriesLeaderboardLoading
							}
							room={room}
							sortBy={sortBy}
							showSeeAllLink={showSeeAllLink}
						/>
					</TabsContent>
					<TabsContent value='all_time'>
						<LeaderboardContent
							leaderboard={allTimeLeaderboard}
							isLoading={isAllTimeLeaderboardLoading}
							room={room}
							sortBy={sortBy}
							showSeeAllLink={showSeeAllLink}
						/>
					</TabsContent>
				</Tabs>
			) : (
				<LeaderboardContent
					leaderboard={leaderboard}
					isLoading={isLeaderboardLoading}
					room={room}
					sortBy={"points"}
					showSeeAllLink={showSeeAllLink}
				/>
			)}
		</div>
	);
}

const contentDelay = {
	rank: 0,
	yourPoints: 200,
	gap: 300,
	leaderboard: 300,
	stats: 300,
};

function LeaderboardContent({
	leaderboard,
	isLoading,
	room,
	sortBy,
	showSeeAllLink = true,
}: Readonly<{
	leaderboard: LeaderboardEntry[];
	isLoading: boolean;
	room: Room;
	sortBy: SortByOption;
	showSeeAllLink?: boolean;
}>) {
	const { data: player } = usePlayer();
	const [leaderboardPlayer, setLeaderboardPlayer] =
		useState<LeaderboardEntry | null>(null);
	const [gapToNextPlayer, setGapToNextPlayer] =
		useState<LeaderboardEntry | null>(null);
	const isRatingsView = sortBy === "ratings";

	const metricValue = (entry: LeaderboardEntry) =>
		isRatingsView
			? (entry.prediction_rating ?? 0)
			: (entry.total_won_in_room ?? 0);
	const currentMetric = leaderboardPlayer
		? metricValue(leaderboardPlayer)
		: 0;
	const gapMetric =
		leaderboardPlayer && gapToNextPlayer
			? metricValue(gapToNextPlayer) - metricValue(leaderboardPlayer)
			: 0;

	useEffect(() => {
		if (!player || leaderboard.length === 0) {
			setLeaderboardPlayer(null);
			setGapToNextPlayer(null);
			return;
		}

		const currentPlayerEntry =
			leaderboard.find((entry) => entry.player_id === player.id) ?? null;
		setLeaderboardPlayer(currentPlayerEntry);

		if (!currentPlayerEntry || currentPlayerEntry.rank === 1) {
			setGapToNextPlayer(null);
			return;
		}

		const nextPlayer =
			leaderboard.find(
				(entry) => entry.rank === currentPlayerEntry.rank - 1,
			) ?? null;
		setGapToNextPlayer(nextPlayer);
	}, [leaderboard, player]);

	const playerId = player?.id;

	return (
		<LeaderboardContentView
			leaderboard={leaderboard}
			isLoading={isLoading}
			room={room}
			playerId={playerId}
			leaderboardPlayer={leaderboardPlayer}
			gapToNextPlayer={gapToNextPlayer}
			isRatingsView={isRatingsView}
			currentMetric={currentMetric}
			gapMetric={gapMetric}
			metricValue={metricValue}
			showSeeAllLink={showSeeAllLink}
		/>
	);
}

function LeaderboardContentView({
	leaderboard,
	isLoading,
	room,
	playerId,
	leaderboardPlayer,
	gapToNextPlayer,
	isRatingsView,
	currentMetric,
	gapMetric,
	metricValue,
	showSeeAllLink,
}: Readonly<{
	leaderboard: LeaderboardEntry[];
	isLoading: boolean;
	room: Room;
	playerId?: string;
	leaderboardPlayer: LeaderboardEntry | null;
	gapToNextPlayer: LeaderboardEntry | null;
	isRatingsView: boolean;
	currentMetric: number;
	gapMetric: number;
	metricValue: (entry: LeaderboardEntry) => number;
	showSeeAllLink: boolean;
}>) {
	return (
		<div className={`flex flex-col gap-4`}>
			<div
				className={`text-card-foreground flex flex-col gap-6 rounded-xl border shadow-sm relative overflow-hidden border-border bg-linear-to-br from-card to-rose-500/5 p-5`}
			>
				<div className={`flex gap-4 items-center`}>
					{isLoading ? (
						<Skeleton
							className={`w-14 h-14 rounded-lg bg-secondary animate-pulse`}
						/>
					) : (
						<FadeContent
							delay={contentDelay.rank}
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
						</FadeContent>
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
						<FadeContent
							delay={contentDelay.yourPoints}
							className={`flex-1`}
						>
							<p className={`text-xs`}>
								{isRatingsView ? "YOUR RATING" : "YOUR POINTS"}
							</p>
							<p className={`text-3xl font-extrabold`}>
								{isRatingsView
									? currentMetric
									: currentMetric.toLocaleString()}
							</p>
						</FadeContent>
					)}

					{isLoading ? (
						<Skeleton
							className={`w-20 h-10 rounded-lg bg-secondary animate-pulse`}
						/>
					) : (
						<>
							{leaderboardPlayer &&
								gapToNextPlayer &&
								gapMetric > 0 && (
									<FadeContent
										delay={contentDelay.gap}
										className={`flex flex-col gap-1`}
									>
										<p
											className={`text-xs justify-end flex items-center gap-1 text-muted-foreground`}
										>
											GAP TO #{gapToNextPlayer.rank}
										</p>
										<p
											className={`text-lg font-bold justify-end flex items-center gap-1 text-accent`}
										>
											+{gapMetric.toLocaleString()}
										</p>
									</FadeContent>
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
						<Skeleton
							className={`h-6 w-20 ml-auto bg-secondary rounded-lg mt-2`}
						/>
					</div>
				) : (
					<LeaderboardMiniRows
						leaderboard={leaderboard}
						playerId={playerId}
						roomCode={room.code}
						isRatingsView={isRatingsView}
						metricValue={metricValue}
						showSeeAllLink={showSeeAllLink}
					/>
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
				<FadeContent
					delay={contentDelay.stats}
					className={`flex gap-2`}
				>
					<StatTile
						icon={<TrophyIcon className={`w-4 h-4 text-rank-1`} />}
						value={leaderboardPlayer?.winning_bets ?? 0}
						label='WINS'
					/>
					<StatTile
						icon={<CrosshairIcon className={`w-4 h-4 text-loss`} />}
						value={`${Math.round(leaderboardPlayer?.win_percentage ?? 0)}%`}
						label='ACCURACY'
					/>
					<StatTile
						icon={<FlameIcon className={`w-4 h-4 text-rank-3`} />}
						value={
							leaderboardPlayer?.current_streak === 0
								? (leaderboardPlayer?.highest_streak ?? 0)
								: (leaderboardPlayer?.current_streak ?? 0)
						}
						label={`${
							leaderboardPlayer?.current_streak === 0
								? "BEST STREAK"
								: "STREAK"
						}`}
					/>
				</FadeContent>
			)}
		</div>
	);
}

function getRankChipStyle(rank: number) {
	if (rank === 1) {
		return {
			backgroundColor: twColor("rank-1", 0.1),
			color: twColor("rank-1"),
		};
	}

	if (rank === 2) {
		return {
			backgroundColor: twColor("rank-2", 0.2),
			color: twColor("foreground"),
		};
	}

	if (rank === 3) {
		return {
			backgroundColor: twColor("rank-3", 0.2),
			color: twColor("rank-3"),
		};
	}

	return {
		backgroundColor: twColor("foreground", 0.001),
		color: twColor("foreground"),
	};
}

function LeaderboardMiniRows({
	leaderboard,
	playerId,
	roomCode,
	isRatingsView,
	metricValue,
	showSeeAllLink,
}: Readonly<{
	leaderboard: LeaderboardEntry[];
	playerId?: string;
	roomCode: string;
	isRatingsView: boolean;
	metricValue: (entry: LeaderboardEntry) => number;
	showSeeAllLink: boolean;
}>) {
	const { room } = useRoomContext();
	const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
		null,
	);
	const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

	return (
		<div className={`flex flex-col gap-2`}>
			{leaderboard.slice(0, 4).map((entry) => {
				const rankChipStyle = getRankChipStyle(entry.rank);

				return (
					<button
						key={entry.player_id + isRatingsView}
						onClick={() => {
							setSelectedPlayerId(entry.player_id);
							setIsProfileDialogOpen(true);
						}}
						className={`cursor-pointer`}
					>
						<FadeContent
							delay={contentDelay.leaderboard}
							className={`flex items-center gap-3 p-3 rounded-lg ${entry.player_id === playerId ? "bg-linear-30 from-accent/10 border to-primary/10" : "bg-secondary/60"}`}
						>
							<p
								className={`w-6 h-6 text-sm font-bold rounded-md flex items-center justify-center`}
								style={rankChipStyle}
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
								{entry.player_id === playerId && (
									<Badge
										variant='outline'
										className={`ml-3 text-xs rounded-md`}
									>
										You
									</Badge>
								)}
							</p>
							<p className={`ml-auto font-bold`}>
								{isRatingsView
									? metricValue(entry)
									: metricValue(entry).toLocaleString()}
								<span
									className={`text-xs ml-1 text-muted-foreground font-normal`}
								>
									{isRatingsView ? "" : "pts"}
								</span>
							</p>
						</FadeContent>
					</button>
				);
			})}
			{showSeeAllLink ? (
				<Link
					to={`/rooms/${roomCode}/leaderboard`}
					className={`flex items-center justify-end text-sm text-accent text-right mt-2 cursor-pointer`}
				>
					see all
					<ChevronRightIcon className={`w-3 h-3 inline-block ml-1`} />
				</Link>
			) : null}

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
