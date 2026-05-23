import React from "react";
import { Badge } from "../../../components/ui/badge";
import { Prediction } from "@/types";
import { usePlayer } from "@/store/player";
import { Skeleton } from "../../../components/ui/skeleton";
import PredictionOptions from "../widgets/PredictionOptions";
import DraftControls from "../controls/DraftControls";
import { useRoomContext } from "../RoomLayout";
import { useRoomBetRealtime } from "@/hooks/useRoomRealtime";
import PredictionTitle from "../components/PredictionTitle";
import { Countdown } from "../widgets/CountDown";

type Props = {
	prediction: Prediction | null | undefined;
	selectedOption: string | null;
	setSelectedOption: React.Dispatch<React.SetStateAction<string | null>>;
};

export default function DraftPhase({
	prediction,
	selectedOption,
	setSelectedOption,
}: Readonly<Props>) {
	const { data: player, isPending: isPlayerLoading } = usePlayer();
	const { room } = useRoomContext();

	useRoomBetRealtime(room.id, prediction?.id ?? null);

	return (
		<div className={`flex-1 flex flex-col gap-4 items-center pb-4 mt-4`}>
			<div
				className={`border border-border rounded-xl p-4 flex flex-col gap-2 bg-secondary/30 w-full transition-colors`}
			>
				{prediction?.status === "draft" ? (
					<Badge
						variant='outline'
						className={`b-4 border-accent text-primary mx-auto`}
					>
						In Play
					</Badge>
				) : (
					<Skeleton className={`h-5 w-25 mx-auto`} />
				)}

				<PredictionTitle prediction={prediction} />

				{prediction?.deadline && prediction.status === "draft" && (
					<Countdown
						targetTime={new Date(prediction.deadline).getTime()}
					/>
				)}

				<PredictionOptions
					prediction={prediction}
					selectedOption={selectedOption}
					setSelectedOption={setSelectedOption}
				/>
			</div>

			<div className={`flex-1`}></div>

			{isPlayerLoading ? (
				<Skeleton
					className={`sticky bottom-2 h-10 w-full max-w-md mx-auto`}
				/>
			) : (
				<div className={`sticky bottom-2 w-full max-w-md mx-auto`}>
					{prediction?.status === "draft" && player && (
						<DraftControls
							player={player}
							predictionId={prediction.id}
							selectedOption={selectedOption}
							setSelectedOption={setSelectedOption}
						/>
					)}
				</div>
			)}
		</div>
	);
}
