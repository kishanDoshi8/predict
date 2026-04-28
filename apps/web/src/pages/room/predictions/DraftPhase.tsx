import React from "react";
import { Badge } from "../../../components/ui/badge";
import { Prediction } from "@/types";
import { usePlayer } from "@/store/player";
import { Skeleton } from "../../../components/ui/skeleton";
import PredictionOptions from "../widgets/PredictionOptions";
import DraftControls from "../controls/DraftControls";
import { Button } from "@/components/ui/button";
import PlayerNew from "@/pages/home/controls/PlayerNew";
import { useRoomContext } from "../RoomLayout";
import { useRoomBetRealtime, useRoomRealtime } from "@/hooks/useRoomRealtime";
import PredictionTitle from "../components/PredictionTitle";
import { Countdown } from "../widgets/CountDown";

type Props = {
	isLoading: boolean;
	prediction: Prediction | null | undefined;
	selectedOption: string | null;
	setSelectedOption: React.Dispatch<React.SetStateAction<string | null>>;
};

export default function DraftPhase({
	isLoading,
	prediction,
	selectedOption,
	setSelectedOption,
}: Readonly<Props>) {
	const { data: player, isPending: isPlayerLoading } = usePlayer();
	const { room } = useRoomContext();

	useRoomRealtime(room.id);
	useRoomBetRealtime(room.id, prediction?.id ?? null);

	const [isOpenCreatePlayer, setIsOpenCreatePlayer] = React.useState(false);

	if (!isLoading && !prediction) {
		return (
			<div className={`flex flex-col gap-4 justify-center items-center`}>
				<p className={`text-muted-foreground text-center`}>
					No active prediction. Please wait for the host to start a
					new prediction.
				</p>
			</div>
		);
	}

	return (
		<div className={`flex-1 flex flex-col gap-4 items-center pb-4 mt-4`}>
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

			<div className={`flex-1`}></div>

			{isPlayerLoading ? (
				<Skeleton
					className={`sticky bottom-2 h-10 w-full max-w-md mx-auto`}
				/>
			) : (
				<div className={`sticky bottom-2 w-full max-w-md mx-auto`}>
					{player ? (
						<>
							{prediction?.status === "draft" && (
								<DraftControls
									player={player}
									predictionId={prediction.id}
									selectedOption={selectedOption}
									setSelectedOption={setSelectedOption}
								/>
							)}
						</>
					) : (
						<Button
							className={`w-full max-w-md mx-auto`}
							onClick={() => setIsOpenCreatePlayer(true)}
						>
							Sign up & Join Room
						</Button>
					)}
				</div>
			)}

			<PlayerNew
				isOpen={isOpenCreatePlayer}
				setIsOpen={setIsOpenCreatePlayer}
				joinRoomCode={room.code}
			/>
		</div>
	);
}
