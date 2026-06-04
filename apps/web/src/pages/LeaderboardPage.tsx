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

const LEADERBOARD_TABS = ["this_week", "all_time"] as const;
type LeaderboardTab = (typeof LEADERBOARD_TABS)[number];

export function LeaderboardPage() {
	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const [activeLeaderboardTab, setActiveLeaderboardTab] =
		useLocalStorage<LeaderboardTab>(
			"this_week",
			localStorageKeys.userPreference.active_leaderboard_tab,
		);

	const {
		data: allTimeLeaderboard = [],
		isPending: isAllTimeLeaderboardLoading,
	} = useRoomLeaderboard(room.id, activeLeaderboardTab === "all_time");

	const {
		data: weeklyLeaderboard = [],
		isPending: isWeeklyLeaderboardLoading,
	} = useRoomWeeklyLeaderboard(room.id, activeLeaderboardTab === "this_week");

	const leaderboard =
		activeLeaderboardTab === "all_time"
			? allTimeLeaderboard
			: weeklyLeaderboard;
	const isLeaderboardLoading =
		activeLeaderboardTab === "all_time"
			? isAllTimeLeaderboardLoading
			: isWeeklyLeaderboardLoading;

	return (
		<div className='flex flex-col gap-4 p-4 max-w-lg mx-auto w-full'>
			{/* Section heading */}
			<div>
				<h2 className='text-lg font-semibold'>Room Rankings</h2>
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

				<TopThreePodium
					top={leaderboard.slice(0, 3)}
					currentPlayerId={player?.id ?? ""}
				/>

				<LeaderboardList
					entries={leaderboard}
					currentPlayerId={player?.id ?? ""}
					isLoading={isLeaderboardLoading}
					scope={activeLeaderboardTab}
				/>
			</div>
		</div>
	);
}
