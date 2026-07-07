import React from "react";
import { Badge } from "@/shared/ui/badge";
import { Prediction, Countdown } from "@/features/predictions";
import { usePlayer } from "@/features/home";
import { Skeleton } from "@/shared/ui/skeleton";
import PredictionOptions from "../widgets/PredictionOptions";
import DraftControls from "../controls/DraftControls";
import { useRoomContext } from "@/app/layouts/RoomLayout";
import { useRoomBetRealtime } from "@/features/rooms";
import PredictionTitle from "../components/PredictionTitle";
import PredictionData from "./PredictionData";

type Props = {
	prediction: Prediction | null | undefined;
	refetchPrediction: () => void;
	selectedOption: string | null;
	setSelectedOption: React.Dispatch<React.SetStateAction<string | null>>;
};

const contentDelays = {
	status: 0,
	title: 0,
	data: 200,
	options: 300,
};

export default function DraftPhase({
	prediction,
	refetchPrediction,
	selectedOption,
	setSelectedOption,
}: Readonly<Props>) {
	const { data: player, isPending: isPlayerLoading } = usePlayer();
	const { room } = useRoomContext();

	useRoomBetRealtime(room.id, prediction?.id ?? null);

	return (
		<div className={`flex-1 flex flex-col gap-4 items-center`}>
			<div
				className={`w-full max-w-md mx-auto text-card-foreground flex flex-col gap-4 rounded-xl border shadow-sm relative overflow-hidden border-border bg-linear-to-br from-card to-rose-500/5 p-5`}
			>
				{prediction?.status === "draft" ? (
					<Badge
						className={`mx-auto bg-primary/25 text-primary font-semibold`}
					>
						<span
							className={`h-2 w-2 rounded-full bg-primary animate-pulse`}
						/>{" "}
						In Play
					</Badge>
				) : (
					<Skeleton className={`h-5 w-25 mx-auto`} />
				)}

				<PredictionTitle
					prediction={prediction}
					fadeDelay={contentDelays.title}
				/>

				{prediction?.deadline ? (
					<>
						{prediction?.deadline &&
							prediction.status === "draft" && (
								<Countdown
									targetTime={new Date(
										prediction.deadline,
									).getTime()}
									textSize='text-2xl'
									onExpire={refetchPrediction}
								/>
							)}
					</>
				) : (
					<Skeleton className={`h-10 w-36 mx-auto`} />
				)}

				<PredictionData
					prediction={prediction}
					fadeDelay={contentDelays.data}
				/>

				<PredictionOptions
					prediction={prediction}
					selectedOption={selectedOption}
					setSelectedOption={setSelectedOption}
					fadeDelay={contentDelays.options}
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
