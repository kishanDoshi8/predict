import { RoomStat } from "@/features/leaderboard";
import DefaultStatCard from "./stats/DefaultStatCard";
import PodiumStatCard from "./stats/PodiumStatCard";

export function RoomStatRenderer({ stat }: Readonly<{ stat: RoomStat }>) {
	switch (stat.type) {
		case "default":
			return <DefaultStatCard stat={stat} />;

		case "podium":
			return <PodiumStatCard />;

		default:
			return null;
	}
}
