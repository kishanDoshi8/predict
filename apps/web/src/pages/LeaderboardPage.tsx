import { useRoomContext } from "./room/RoomLayout";
import { usePlayer } from "@/store/player";
import {
	useRoomLeaderboard,
	useRoomWeeklyLeaderboard,
} from "@/store/leaderboard";
import { LeaderboardList } from "./room/leaderboard/LeaderboardList";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TopThreePodium } from "./room/leaderboard/TopThreePodium";

const LEADERBOARD_TABS = ["This Week", "All Time"] as const;
type LeaderboardTab = (typeof LEADERBOARD_TABS)[number];

export function LeaderboardPage() {
	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const [activeLeaderboardTab, setActiveLeaderboardTab] =
		useState<LeaderboardTab>("This Week");

	const {
		data: allTimeLeaderboard = [],
		isPending: isAllTimeLeaderboardLoading,
	} = useRoomLeaderboard(room.id, activeLeaderboardTab === "All Time");

	const {
		data: weeklyLeaderboard = [],
		isPending: isWeeklyLeaderboardLoading,
	} = useRoomWeeklyLeaderboard(room.id, activeLeaderboardTab === "This Week");

	const leaderboard =
		activeLeaderboardTab === "All Time"
			? allTimeLeaderboard
			: weeklyLeaderboard;
	const isLeaderboardLoading =
		activeLeaderboardTab === "All Time"
			? isAllTimeLeaderboardLoading
			: isWeeklyLeaderboardLoading;

	return (
		<div className='flex flex-col gap-4 py-4 max-w-lg mx-auto w-full'>
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
								"flex-1 text-sm py-1.5 rounded-md font-medium transition-colors",
								activeLeaderboardTab === tab
									? "bg-background shadow-sm text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{tab}
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
