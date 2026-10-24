import { InPlayPredictions, UserStats } from "@/features/predictions";
import { SeriesHeroCard } from "@/features/rooms/components/SeriesHeroCard";

function RoomDashboard() {
	return (
		<div className={`px-4`}>
			<div className={`mt-2`}>
				<SeriesHeroCard />
			</div>

			<div className={`mt-4`}>
				<InPlayPredictions />
			</div>

			<div className={`mt-6`}>
				<UserStats />
			</div>
		</div>
	);
}

export default RoomDashboard;
