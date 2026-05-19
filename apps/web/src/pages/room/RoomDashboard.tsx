import { useActivePrediction } from "@/store/prediction";
import { LeaderboardPage } from "../LeaderboardPage";
import InPlayPredictions from "./components/InPlayPredictions";
import PredictionHeader from "./components/PredictionHeader";
import { CreatePredictionButton } from "./controls/OrganizerControls";
import { useRoomContext } from "./RoomLayout";

function RoomDashboard() {
	const { room } = useRoomContext();
	const { data: activePrediction, isPending: isActivePredictionPending } =
		useActivePrediction(room.id);
	return (
		<div>
			<PredictionHeader />

			<InPlayPredictions />
			<div className={`mt-6`}>
				<LeaderboardPage />
			</div>

			{!activePrediction && !isActivePredictionPending && (
				<CreatePredictionButton
					className={`mt-4 fixed left-4 right-4 bottom-4 z-50`}
				/>
			)}
		</div>
	);
}

export default RoomDashboard;
