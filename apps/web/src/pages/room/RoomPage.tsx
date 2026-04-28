import { useActivePrediction } from "@/store/prediction";
import { useState } from "react";
import { PredictionPhaseView } from "./predictions/PredictionPhaseView";
import { useRoomContext } from "./RoomLayout";
import { CreatePredictionButton } from "@/pages/room/controls/OrganizerControls";
import PredictionHeader from "./components/PredictionHeader";

// // ============================================================
// // RoomPage
// // Bootstraps session, loads room state, starts Realtime,
// // triggers weekly claim check.
// // ============================================================

export function RoomPage() {
	const { room } = useRoomContext();
	const { data: activePrediction, isPending: isActivePredictionPending } =
		useActivePrediction(room.id);
	const [selectedOption, setSelectedOption] = useState<string | null>(null);

	if (!room) return null; // This should never happen because RoomLayout already checks for room and redirects to 404 if not found

	return (
		<>
			<PredictionHeader />

			<PredictionPhaseView
				isLoading={isActivePredictionPending}
				prediction={activePrediction}
				selectedOption={selectedOption}
				setSelectedOption={setSelectedOption}
			/>

			{!activePrediction && !isActivePredictionPending && (
				<CreatePredictionButton
					className={`mt-4 fixed left-4 right-4 bottom-4 z-50`}
				/>
			)}
		</>
	);
}
