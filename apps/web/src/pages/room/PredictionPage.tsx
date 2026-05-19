import { usePrediction } from "@/store/prediction";
import { useState } from "react";
import { PredictionPhaseView } from "./predictions/PredictionPhaseView";
import { useRoomContext } from "./RoomLayout";
import PredictionHeader from "./components/PredictionHeader";
import { useParams } from "react-router-dom";

// // ============================================================
// // PredictionPage
// // Bootstraps session, loads room state, starts Realtime,
// // triggers weekly claim check.
// // ============================================================

export function PredictionPage() {
	const { predictionId } = useParams<{ predictionId: string }>();

	const { room } = useRoomContext();
	const { data: prediction, isPending: isPredictionLoading } = usePrediction(
		room.id,
		predictionId,
	);
	const [selectedOption, setSelectedOption] = useState<string | null>(null);

	if (!room) return null; // This should never happen because RoomLayout already checks for room and redirects to 404 if not found

	return (
		<>
			<PredictionHeader />

			<PredictionPhaseView
				isLoading={isPredictionLoading}
				prediction={prediction}
				selectedOption={selectedOption}
				setSelectedOption={setSelectedOption}
			/>
		</>
	);
}
