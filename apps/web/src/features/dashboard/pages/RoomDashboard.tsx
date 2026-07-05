import InPlayPredictions from "./components/InPlayPredictions";
import PredictionHeader from "./components/PredictionHeader";
import { CreatePredictionButton } from "./controls/OrganizerControls";
import HistoryFeed from "./components/HistoryFeed";
import UserStats from "./components/stats/UserStats";

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
