import { Alert, AlertDescription, AlertTitle, Skeleton } from "@/components";
import { Prediction } from "@/types";
import PredictionTitle from "../components/PredictionTitle";
import PredictionOptions from "../widgets/PredictionOptions";
import { useRoomContext } from "../RoomLayout";
import { useBets } from "@/store/bet";
import { useEffect } from "react";
import { usePlayer } from "@/store/player";
import { useOptionColor } from "@/hooks/useOptionColor";
import { Lock } from "lucide-react";
import LockControls from "../controls/LockControls";
import { useRoomBetRealtime, useRoomRealtime } from "@/hooks/useRoomRealtime";

type Props = {
	prediction: Prediction | null | undefined;
	selectedOption: string | null;
};

export default function LockedPhase({
	prediction,
	selectedOption,
}: Readonly<Props>) {
	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const {
		data: bets,
		isLoading: isBetsLoading,
		refetch: refetchBets,
	} = useBets(room.id, prediction?.id);

	useRoomRealtime(room.id);
	useRoomBetRealtime(room.id, prediction?.id ?? null);

	useEffect(() => {
		if (prediction) {
			refetchBets();
		}
	}, [prediction]);

	const getPlayerName = (playerId: string) => {
		if (player?.id === playerId) {
			return player.username + " (You)";
		}
		const member = room.members.find((m) => m.player_id === playerId);
		return member ? member.player.username : "Unknown";
	};

	return (
		<div className={`flex-1 flex flex-col gap-4 items-center pb-4 mt-4`}>
			<Alert variant='default' className={`w-full max-w-md mx-auto mb-4`}>
				<Lock />
				<AlertTitle>Betting is now closed!</AlertTitle>
				<AlertDescription>
					The host has locked the prediction. Please wait for the
					results.
				</AlertDescription>
			</Alert>

			<PredictionTitle prediction={prediction} />

			<PredictionOptions
				prediction={prediction}
				selectedOption={selectedOption}
				setSelectedOption={() => {}}
			/>

			<div
				className={`max-w-md w-full mx-auto mt-4 p-4 border rounded-lg bg-secondary/50`}
			>
				<div className={`flex mb-2`}>
					<p className={`text-xl`}>Who bet what?</p>
				</div>
				{isBetsLoading ? (
					<>
						<Skeleton className={`h-15 w-full mx-auto mt-4`} />
						<Skeleton className={`h-15 w-full mx-auto mt-4`} />
					</>
				) : (
					<div>
						{bets?.map((bet) => (
							<div
								key={bet.id}
								className={`flex justify-between mt-2 border border-secondary hover:bg-accent p-4 rounded-xl`}
							>
								<div>
									<p>{getPlayerName(bet.player_id)}</p>
									<p>{}</p>
								</div>
								<div>
									<p>{bet.amount} PTS</p>
									<p
										className={`text-sm text-right ${useOptionColor(bet.option?.id ?? "")}`}
									>
										on {bet.option?.label ?? "Unknown"}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<LockControls />
		</div>
	);
}
