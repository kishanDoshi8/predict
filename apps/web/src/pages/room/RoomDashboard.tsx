import { useActivePrediction } from "@/store/prediction";
import { LeaderboardPage } from "../LeaderboardPage";
import InPlayPredictions from "./components/InPlayPredictions";
import PredictionHeader from "./components/PredictionHeader";
import { CreatePredictionButton } from "./controls/OrganizerControls";
import { useRoomContext } from "./RoomLayout";

function RoomDashboard() {
	const { room } = useRoomContext();
	const { data: activePrediction } = useActivePrediction(room.id);

	return (
		<div>
			<PredictionHeader />

			<InPlayPredictions />
			<div className={`mt-6`}>
				<LeaderboardPage />
			</div>

			{activePrediction &&
				!["draft", "locked"].includes(activePrediction.status) && (
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
