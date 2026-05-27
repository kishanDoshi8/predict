import { useActivePredictions } from "@/store/prediction";
import InPlayPredictions from "./components/InPlayPredictions";
import PredictionHeader from "./components/PredictionHeader";
import { CreatePredictionButton } from "./controls/OrganizerControls";
import { useRoomContext } from "./RoomLayout";
import HistoryFeed from "./components/HistoryFeed";
import UserStats from "./components/stats/UserStats";

function RoomDashboard() {
	const { room } = useRoomContext();
	const { data: predictions = [] } = useActivePredictions(room.id);

	// Count predictions that are still active (draft or locked)
	const activeCount = predictions.filter(
		(p) => p.status === "draft" || p.status === "locked",
	).length;

	// Show the create button when below the room's predictions limit
	const canCreatePrediction = activeCount < room.predictions_limit;

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

			{canCreatePrediction && (
				<div
					className={`bg-background px-4 pt-4 pb-6 border-t-2 mt-4 sticky left-4 right-4 bottom-0 z-50 w-full max-w-md mx-auto`}
				>
					<CreatePredictionButton />
				</div>
			)}
		</div>
	);
}

export default RoomDashboard;
