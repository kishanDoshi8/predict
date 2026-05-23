import { useActivePredictions } from "@/store/prediction";
import { LeaderboardPage } from "../LeaderboardPage";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import InPlayPredictions from "./components/InPlayPredictions";
import PredictionHeader from "./components/PredictionHeader";
import RoomStatsCards from "./components/RoomStatsCards";
import { CreatePredictionButton } from "./controls/OrganizerControls";
import { useRoomContext } from "./RoomLayout";

function RoomDashboard() {
	const { room } = useRoomContext();
	const { data: predictions = [] } = useActivePredictions(room.id);
	useRoomRealtime(room.id);

	// Count predictions that are still active (draft or locked)
	const activeCount = predictions.filter(
		(p) => p.status === "draft" || p.status === "locked",
	).length;

	// Show the create button when below the room's predictions limit
	const canCreatePrediction = activeCount < room.predictions_limit;

	return (
		<div>
			<PredictionHeader />
			<RoomStatsCards />

			<InPlayPredictions />
			<div className={`mt-6`}>
				<LeaderboardPage />
			</div>

			{canCreatePrediction && (
				<div
					className={`mt-4 sticky left-4 right-4 bottom-4 z-50 w-3/4 max-w-md mx-auto`}
				>
					<CreatePredictionButton />
				</div>
			)}
		</div>
	);
}

export default RoomDashboard;
