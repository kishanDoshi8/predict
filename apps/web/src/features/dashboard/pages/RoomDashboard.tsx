import InPlayPredictions from "@/features/prediction-details/components/InPlayPredictions";
import PredictionHeader from "@/features/prediction-details/components/PredictionHeader";
import { CreatePredictionButton } from "@/features/prediction-details/controls/OrganizerControls";
import HistoryFeed from "@/features/prediction-details/components/HistoryFeed";
import UserStats from "@/features/prediction-details/components/stats/UserStats";

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

			<CreatePredictionButton />
		</div>
	);
}

export default RoomDashboard;
