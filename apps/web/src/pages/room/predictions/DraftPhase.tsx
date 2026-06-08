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
import PredictionData from "./PredictionData";
import FadeContent from "@/components/animations/fade-content";

type Props = {
	prediction: Prediction | null | undefined;
	selectedOption: string | null;
	setSelectedOption: React.Dispatch<React.SetStateAction<string | null>>;
};

const contentDelays = {
	title: 0,
	data: 200,
	options: 300,
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

				<FadeContent delay={contentDelays.title}>
					<PredictionTitle prediction={prediction} />
				</FadeContent>

				{prediction?.deadline ? (
					<>
						{prediction?.deadline &&
							prediction.status === "draft" && (
								<Countdown
									targetTime={new Date(
										prediction.deadline,
									).getTime()}
									textSize='text-2xl'
								/>
							)}
					</>
				) : (
					<Skeleton className={`h-10 w-36 mx-auto`} />
				)}
				<FadeContent delay={contentDelays.data}>
					<PredictionData prediction={prediction} />
				</FadeContent>

				<FadeContent delay={contentDelays.options}>
					<PredictionOptions
						prediction={prediction}
						selectedOption={selectedOption}
						setSelectedOption={setSelectedOption}
					/>
				</FadeContent>
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
