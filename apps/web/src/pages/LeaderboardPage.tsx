import { useRoomContext } from "./room/RoomLayout";
import { usePlayer } from "@/store/player";
import {
	useRoomLeaderboard,
	useRoomWeeklyLeaderboard,
} from "@/store/leaderboard";
import { LeaderboardList } from "./room/leaderboard/LeaderboardList";
import { cn } from "@/lib/utils";
import { TopThreePodium } from "./room/leaderboard/TopThreePodium";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { localStorageKeys } from "@/store/_keys";
import { ArrowDown10Icon, CircleQuestionMarkIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components";
import LeaderboardTipsDialog from "@/components/LeaderboardTipsDialog";
import { useMarkRatingsTipSeen, usePreferences } from "@/store/preferences";
import React from "react";
import { PlayerProfileDialog } from "./room/leaderboard/PlayerProfileDialog";

const LEADERBOARD_TABS = ["this_week", "all_time"] as const;
type LeaderboardTab = (typeof LEADERBOARD_TABS)[number];

const SORT_BY_OPTIONS = ["points", "ratings"] as const;
export type SortByOption = (typeof SORT_BY_OPTIONS)[number];

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
		useLocalStorage<LeaderboardTab>(
			"this_week",
			localStorageKeys.userPreference.leaderboard.active_leaderboard_tab,
		);

	const [sortBy, setSortBy] = useLocalStorage<SortByOption>(
		"ratings",
		localStorageKeys.userPreference.leaderboard.sort_by,
	);
	const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | null>(null);
	const [isProfileDialogOpen, setIsProfileDialogOpen] = React.useState(false);

	const {
		data: allTimeLeaderboard = [],
		isPending: isAllTimeLeaderboardLoading,
	} = useRoomLeaderboard(
		room.id,
		activeLeaderboardTab === "all_time",
		sortBy,
	);

	const {
		data: weeklyLeaderboard = [],
		isPending: isWeeklyLeaderboardLoading,
	} = useRoomWeeklyLeaderboard(
		room.id,
		activeLeaderboardTab === "this_week",
		sortBy,
	);

	const leaderboard =
		activeLeaderboardTab === "all_time"
			? allTimeLeaderboard
			: weeklyLeaderboard;
	const isLeaderboardLoading =
		activeLeaderboardTab === "all_time"
			? isAllTimeLeaderboardLoading
			: isWeeklyLeaderboardLoading;

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
								activeLeaderboardTab === tab
									? "bg-linear-to-r from-primary to-accent shadow-sm text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{tab === "this_week" ? "This Week" : "All Time"}
						</button>
					))}
				</div>

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
					scope={activeLeaderboardTab}
					sortBy={sortBy}
					onRowClick={(playerId) => {
						setSelectedPlayerId(playerId);
						setIsProfileDialogOpen(true);
					}}
				/>
			</div>

			<PlayerProfileDialog
				roomId={room.id}
				playerId={selectedPlayerId}
				open={isProfileDialogOpen}
				onOpenChange={(open) => {
					setIsProfileDialogOpen(open);
					if (!open) setSelectedPlayerId(null);
				}}
			/>

			<LeaderboardTipsDialog
				open={isTipsDialogOpen}
				onOpenChange={handleTipsDialogOpenChange}
			/>
		</div>
	);
}
