import { usePrediction } from "@/store/prediction";
import { useState } from "react";
import { PredictionPhaseView } from "./predictions/PredictionPhaseView";
import { useRoomContext } from "./RoomLayout";
import { useNavigate, useParams } from "react-router-dom";
import { usePredictionDuels, getDuelSummary } from "@/store/duel";
import { DuelSummaryCard } from "./duels/components/DuelSummaryCard";
import { usePredictionDuelRealtime } from "@/hooks/useRoomRealtime";

// // ============================================================
// // PredictionPage
// // Bootstraps session, loads room state, starts Realtime,
// // triggers weekly claim check.
// // ============================================================

export function PredictionPage() {
	const { predictionId } = useParams<{ predictionId: string }>();
	const navigate = useNavigate();

	const { room } = useRoomContext();
	const { data: prediction, isPending: isPredictionLoading } = usePrediction(
		room.id,
		predictionId,
	);
	const { data: duels = [] } = usePredictionDuels(room.id, predictionId);
	const [selectedOption, setSelectedOption] = useState<string | null>(null);
	const duelSummary = getDuelSummary(duels);

	usePredictionDuelRealtime(room.id, predictionId ?? null);

	if (!room) return null; // This should never happen because RoomLayout already checks for room and redirects to 404 if not found

	return (
		<div>
			<div className={`p-4`}>
				{prediction && (
					<div className='mb-4 max-w-md mx-auto'>
						<DuelSummaryCard
							summary={duelSummary}
							onClick={() =>
								navigate(
									`/rooms/${room.code}/predictions/${prediction.id}/duels`,
								)
							}
						/>
					</div>
				)}
				<PredictionPhaseView
					isLoading={isPredictionLoading}
					prediction={prediction}
					selectedOption={selectedOption}
					setSelectedOption={setSelectedOption}
				/>
			</div>
		</div>
	);
}
