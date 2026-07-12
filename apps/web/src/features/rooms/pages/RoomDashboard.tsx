import {
	HistoryFeed,
	InPlayPredictions,
	PredictionHeader,
	UserStats,
} from "@/features/predictions";

function RoomDashboard() {
	return (
		<div>
			<div className={`px-4`}>
				<PredictionHeader />

				<div className={`mt-2`}>
					<InPlayPredictions />
				</div>

				<div className={`mt-6`}>
					<UserStats />
				</div>

				<div className={`mt-4`}>
					<HistoryFeed />
				</div>
			</div>
		</div>
	);
}

export default RoomDashboard;
