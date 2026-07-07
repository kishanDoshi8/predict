import { usePrediction, PredictionPhaseView } from "@/features/predictions";
import { useEffect, useState } from "react";
import { useRoomContext } from "@/app/layouts/RoomLayout";
import { useNavigate, useParams } from "react-router-dom";
import { usePredictionDuelSummary, DuelSummaryCard } from "@/features/duels";
import { usePredictionDuelRealtime } from "@/features/rooms";
import { Skeleton } from "@/shared/ui";

// // ============================================================
// // PredictionPage
// // Bootstraps session, loads room state, starts Realtime,
// // triggers weekly claim check.
// // ============================================================

export function PredictionPage() {
	const { predictionId } = useParams<{ predictionId: string }>();
	const navigate = useNavigate();

	const [showDuelSummary, setShowDuelSummary] = useState(true);

	const { room } = useRoomContext();
	const {
		data: prediction,
		isPending: isPredictionLoading,
		refetch: refetchPrediction,
	} = usePrediction(room.id, predictionId);
	const { data: duelSummary } = usePredictionDuelSummary(
		room.id,
		predictionId,
	);
	const [selectedOption, setSelectedOption] = useState<string | null>(null);

	useEffect(() => {
		const hideDuelSummary =
			prediction?.status !== "draft" &&
			duelSummary?.totalDuels === 0 &&
			duelSummary?.totalStake === 0 &&
			duelSummary?.uniqueParticipants === 0;
		setShowDuelSummary(!hideDuelSummary);
	}, [prediction, duelSummary]);

	usePredictionDuelRealtime(room.id, predictionId ?? null);

	if (!room) return null; // This should never happen because RoomLayout already checks for room and redirects to 404 if not found

	return (
		<div>
			<div className={`p-4`}>
				{showDuelSummary && (
					<>
						{prediction && duelSummary ? (
							<div className='mb-4 max-w-md mx-auto'>
								<DuelSummaryCard
									summary={duelSummary}
									predictionStatus={prediction.status}
									onClick={() =>
										navigate(
											`/rooms/${room.code}/predictions/${prediction.id}/duels`,
										)
									}
								/>
							</div>
						) : (
							// loading state
							<Skeleton className='mb-4 h-52 w-full max-w-md mx-auto rounded-2xl' />
						)}
					</>
				)}
				<PredictionPhaseView
					isLoading={isPredictionLoading}
					prediction={prediction}
					refetchPrediction={refetchPrediction}
					selectedOption={selectedOption}
					setSelectedOption={setSelectedOption}
				/>
			</div>
		</div>
	);
}
