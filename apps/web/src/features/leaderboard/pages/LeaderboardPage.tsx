import { useRoomContext } from "@/app/layouts/RoomLayout";
import { usePlayer } from "@/features/home";
import {
	useRoomLeaderboard,
	useSeriesLeaderboard,
	LeaderboardList,
	TopThreePodium,
} from "@/features/leaderboard";
import { SeriesSelector } from "@/features/series";
import type { SortByOption } from "@/features/leaderboard/types/types";
import { cn } from "@/shared/lib/utils";
import { useLocalStorage } from "@/shared/hooks/useLocalStorage";
import { localStorageKeys } from "@/shared/constants/queryKeys";
import { ArrowDown10Icon, CircleQuestionMarkIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui";
import { useMarkRatingsTipSeen, usePreferences } from "@/features/preferences";
import React, { Suspense, lazy } from "react";

const LeaderboardTipsDialog = lazy(
	() => import("@/features/onboarding/components/LeaderboardTipsDialog"),
);
const PlayerProfileDialog = lazy(() =>
	import("@/features/leaderboard/components/player/PlayerProfileDialog").then(
		(module) => ({ default: module.PlayerProfileDialog }),
	),
);

const LEADERBOARD_TABS = ["series", "all_time"] as const;
type LeaderboardTab = (typeof LEADERBOARD_TABS)[number];

export function LeaderboardPage() {
	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const { data: preferences } = usePreferences(room.id);
	const { mutate: markRatingsTipSeen } = useMarkRatingsTipSeen(room.id);
	const [isTipsDialogOpen, setIsTipsDialogOpen] = React.useState(false);
	const [tipsDialogSource, setTipsDialogSource] = React.useState<
		"onboarding" | "help" | null
	>(null);
	const hasOpenedOnboardingRef = React.useRef(false);
	const hasMarkedRatingsTipSeenRef = React.useRef(false);
	const [activeLeaderboardTab, setActiveLeaderboardTab] =
		useLocalStorage<string>(
			"series",
			localStorageKeys.userPreference.leaderboard.active_leaderboard_tab,
		);

	const [sortBy, setSortBy] = useLocalStorage<SortByOption>(
		"ratings",
		localStorageKeys.userPreference.leaderboard.sort_by,
	);
	const [selectedPlayerId, setSelectedPlayerId] = React.useState<
		string | null
	>(null);
	const [isProfileDialogOpen, setIsProfileDialogOpen] = React.useState(false);

	const normalizedLeaderboardTab: LeaderboardTab =
		activeLeaderboardTab === "all_time" ? "all_time" : "series";

	const [selectedSeriesId, setSelectedSeriesId] = React.useState<string | null>(
		null,
	);

	const {
		data: allTimeLeaderboard = [],
		isPending: isAllTimeLeaderboardLoading,
	} = useRoomLeaderboard(
		room.id,
		normalizedLeaderboardTab === "all_time",
		sortBy,
	);

	const {
		data: seriesLeaderboard = [],
		isPending: isSeriesLeaderboardLoading,
	} = useSeriesLeaderboard(
		room.id,
		selectedSeriesId,
		normalizedLeaderboardTab === "series",
		sortBy,
	);

	React.useEffect(() => {
		if (activeLeaderboardTab === "this_week") {
			setActiveLeaderboardTab("series");
		}
	}, [activeLeaderboardTab, setActiveLeaderboardTab]);

	const leaderboard =
		normalizedLeaderboardTab === "all_time"
			? allTimeLeaderboard
			: seriesLeaderboard;
	const isLeaderboardLoading =
		normalizedLeaderboardTab === "all_time"
			? isAllTimeLeaderboardLoading
			: isSeriesLeaderboardLoading;

	React.useEffect(() => {
		if (!preferences) return;
		if (preferences.has_seen_ratings_tip) return;
		if (hasOpenedOnboardingRef.current) return;
		if (isTipsDialogOpen) return;

		hasOpenedOnboardingRef.current = true;
		setTipsDialogSource("onboarding");
		setIsTipsDialogOpen(true);
	}, [preferences, isTipsDialogOpen]);

	const handleTipsDialogOpenChange = (open: boolean) => {
		setIsTipsDialogOpen(open);

		if (open) return;

		if (
			tipsDialogSource === "onboarding" &&
			!hasMarkedRatingsTipSeenRef.current
		) {
			hasMarkedRatingsTipSeenRef.current = true;
			markRatingsTipSeen();
		}

		setTipsDialogSource(null);
	};

	return (
		<div className='flex flex-col gap-4 p-4 max-w-lg mx-auto w-full'>
			{/* Section heading */}
			<div>
				<h2 className='flex gap-2 items-center text-lg font-semibold'>
					Room Rankings{" "}
					<button
						type='button'
						onClick={() => {
							setTipsDialogSource("help");
							setIsTipsDialogOpen(true);
						}}
						className='rounded-sm text-muted-foreground hover:text-foreground transition-colors'
						aria-label='Open leaderboard tips'
					>
						<CircleQuestionMarkIcon className='h-4 w-4' />
					</button>
				</h2>
				<p className='text-sm text-muted-foreground'>
					{room.members.length} member
					{room.members.length === 1 ? "" : "s"}
				</p>
			</div>

			<div className='flex flex-col gap-3'>
				<div className='flex gap-1 p-1 rounded-lg bg-muted'>
					{LEADERBOARD_TABS.map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveLeaderboardTab(tab)}
							className={cn(
								"flex-1 text-sm py-2 rounded-md font-bold transition-colors",
								normalizedLeaderboardTab === tab
									? "bg-linear-to-r from-primary to-accent shadow-sm text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{tab === "series" ? "Series" : "All Time"}
						</button>
					))}
				</div>

				{normalizedLeaderboardTab === "series" ? (
					<SeriesSelector
						roomId={room.id}
						mode='active-or-last'
						value={selectedSeriesId}
						onValueChange={setSelectedSeriesId}
						placeholder='Select series'
						autoSelect
					/>
				) : null}

				{/* Sort by */}
				<div className={`flex gap-1 my-1 justify-end items-center`}>
					<ArrowDown10Icon className={`text-muted-foreground/70`} />
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
						<ToggleGroupItem value='ratings'>Skill</ToggleGroupItem>
						<ToggleGroupItem value='points'>Wealth</ToggleGroupItem>
					</ToggleGroup>
				</div>

				<TopThreePodium
					top={leaderboard.slice(0, 3)}
					currentPlayerId={player?.id ?? ""}
					sortBy={sortBy}
				/>

				<LeaderboardList
					entries={leaderboard}
					currentPlayerId={player?.id ?? ""}
					isLoading={isLeaderboardLoading}
					scope={normalizedLeaderboardTab}
					sortBy={sortBy}
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

			{isTipsDialogOpen ? (
				<Suspense fallback={null}>
					<LeaderboardTipsDialog
						open={isTipsDialogOpen}
						onOpenChange={handleTipsDialogOpenChange}
					/>
				</Suspense>
			) : null}
		</div>
	);
}
