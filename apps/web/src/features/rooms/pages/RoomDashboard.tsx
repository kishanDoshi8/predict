import { InPlayPredictions, UserStats } from "@/features/predictions";
import { NeedsYouCard } from "@/features/rooms/components/NeedsYouCard";
import { SeriesHeroCard } from "@/features/rooms/components/SeriesHeroCard";

function RoomDashboard() {
	return (
		<div className={`px-4`}>
			<div className={`mt-2`}>
				<SeriesHeroCard />
				<NeedsYouCard />
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
