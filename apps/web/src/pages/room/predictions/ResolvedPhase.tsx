import {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Skeleton,
} from "@/components";
import { Prediction } from "@/types";
import PredictionTitle from "../components/PredictionTitle";
import PredictionOptions from "../widgets/PredictionOptions";
import { CheckCircle } from "lucide-react";
import { useBets } from "@/store/bet";
import { useRoomContext } from "../RoomLayout";
import { usePlayer } from "@/store/player";
import { useOptionColor } from "@/hooks/useOptionColor";
import { useRoomBetRealtime } from "@/hooks/useRoomRealtime";

type Props = {
	prediction: Prediction | null | undefined;
};

function ResolvedPhase({ prediction }: Readonly<Props>) {
	if (!prediction) return null;

	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const { data: bets, isPending: isBetsLoading } = useBets(
		room.id,
		prediction.id,
	);

	useRoomBetRealtime(room.id, prediction?.id ?? null);

	const getPlayerName = (playerId: string) => {
		if (player?.id === playerId) {
			return player.username + " (You)";
		}
		const member = room.members.find((m) => m.player_id === playerId);
		return member ? member.player.username : "Unknown";
	};

	return (
		<div className={`flex-1 flex flex-col gap-4 items-center pb-4 mt-4`}>
			<Alert className={`mb-4 border-primary w-full max-w-md mx-auto`}>
				<CheckCircle />
				<AlertTitle>Verdict:</AlertTitle>
				<AlertDescription
					className={`text-secondary-foreground text-2xl`}
				>
					{
						prediction.prediction_options.find(
							(o) => o.id === prediction.winning_option_id,
						)?.label
					}
					{prediction.resolved_at && (
						<span className={`text-muted-foreground text-sm`}>
							Resolved at:{" "}
							{new Date(prediction.resolved_at).toLocaleString()}
						</span>
					)}
				</AlertDescription>
			</Alert>

			<div
				className={`border border-border rounded-xl p-4 flex flex-col gap-2 bg-secondary/30 w-full transition-colors`}
			>
				<PredictionTitle prediction={prediction} />

				<PredictionOptions
					prediction={prediction}
					selectedOption={null}
					setSelectedOption={() => {}}
				/>
			</div>

			<div className={`max-w-md w-full mx-auto mt-4`}>
				<div className={`flex mb-2`}>
					<p className={`text-2xl`}>Payout</p>
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
									<p className={`text-lg`}>
										{getPlayerName(bet.player_id)}
									</p>
									<p className={`text-sm`}>
										<span
											className={`text-muted-foreground`}
										>
											{bet.amount} PTS{" "}
										</span>
										<span
											className={`text-sm text-right ${useOptionColor(bet.option?.id ?? "")}`}
										>
											on {bet.option?.label ?? "Unknown"}
										</span>
									</p>
								</div>
								<div className={`flex flex-col items-end`}>
									<p className={`text-lg`}>
										{bet.payout} PTS
									</p>
									{bet.payout !== null && (
										<Badge
											variant={
												bet.payout - bet.amount > 0
													? "default"
													: "destructive"
											}
										>
											{bet.payout - bet.amount > 0
												? "+"
												: ""}
											{bet.payout - bet.amount} PTS
										</Badge>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export default ResolvedPhase;
