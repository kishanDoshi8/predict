import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
	Badge,
	FadeContent,
	Skeleton,
} from "@/shared/ui";
import { Prediction, useBets } from "@/features/predictions";
import PredictionTitle from "../components/PredictionTitle";
import PredictionOptions from "../widgets/PredictionOptions";
import { BicepsFlexed, CheckIcon, CrownIcon, FrownIcon } from "lucide-react";
import { useRoomContext } from "@/app/layouts/RoomLayout";
import { usePlayer } from "@/features/home";
import { useRoomBetRealtime } from "@/features/rooms";
import PredictionData from "./PredictionData";
import { PlayerProfileDialog } from "@/features/leaderboard";
import { useState } from "react";
import { ShareResultButton } from "../components/ShareResultButton";
import type { ResultShareData } from "../components/ResultShareCard";

type Props = {
	prediction: Prediction | null | undefined;
};

const contentDelays = {
	title: 0,
	result: 50,
	data: 100,
	options: 100,
	payout: 100,
};

function ResolvedPhase({ prediction }: Readonly<Props>) {
	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const { data: bets, isPending: isBetsLoading } = useBets(
		room.id,
		prediction?.id,
	);

	const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
		null,
	);
	const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

	useRoomBetRealtime(room.id, prediction?.id ?? null);

	// Hooks above run on every render; bail out only after them.
	if (!prediction) return null;

	const optionLabel = (optionId: string) =>
		prediction.prediction_options.find((option) => option.id === optionId)
			?.label ?? "";
	const myBet = bets?.find((bet) => bet.player_id === player?.id);
	const shareData: ResultShareData | null =
		prediction.status === "revealed" && prediction.winning_option_id && bets
			? {
					seriesLabel:
						[
							prediction.seriesPredictionNumber
								? `#${prediction.seriesPredictionNumber}`
								: null,
							prediction.seriesTitle,
						]
							.filter(Boolean)
							.join(" · ") || null,
					question: prediction.title,
					winner: optionLabel(prediction.winning_option_id),
					calledIt: bets.filter(
						(bet) => bet.option_id === prediction.winning_option_id,
					).length,
					participants: bets.length,
					pool: bets.reduce((sum, bet) => sum + bet.amount, 0),
					player:
						myBet && player
							? {
									username: player.username,
									pick: optionLabel(myBet.option_id),
									net: (myBet.payout ?? 0) - myBet.amount,
								}
							: null,
				}
			: null;

	const getPlayerName = (playerId: string) => {
		if (player?.id === playerId) {
			return player.username + " (You)";
		}
		const member = room.members.find((m) => m.player_id === playerId);
		return member ? member.player.username : "Unknown";
	};

	return (
		<div className={`flex-1 flex flex-col gap-4 items-center pb-4 mt-4`}>
			<div
				className={`flex flex-col justify-center items-center gap-4 w-full max-w-md max-auto relative overflow-hidden rounded-2xl bg-linear-to-br from-win/20 via-card to-emerald-500/10 border border-green-500/30 p-5`}
			>
				{prediction?.status === "revealed" ? (
					<Badge
						className={`mx-auto bg-win/25 text-win font-semibold`}
					>
						<CheckIcon className={`w-3 h-3`} />
						REVEALED
					</Badge>
				) : (
					<Skeleton className={`h-5 w-25 mx-auto`} />
				)}

				<PredictionTitle
					prediction={prediction}
					fadeDelay={contentDelays.title}
				/>

				<div
					className={`flex gap-2 items-center justify-center bg-win/10 rounded-xl px-4 py-2`}
				>
					<CrownIcon className={`text-win rounded-full mx-auto`} />
					<p className={`text-center text-lg font-semibold`}>
						<span className={`text-2xl text-win`}>
							{
								prediction.prediction_options.find(
									(option) =>
										option.id ===
										prediction.winning_option_id,
								)?.label
							}
						</span>
					</p>
				</div>

				<PredictionData
					prediction={prediction}
					fadeDelay={contentDelays.data}
				/>

				<PredictionOptions
					prediction={prediction}
					selectedOption={null}
					setSelectedOption={() => {}}
					fadeDelay={contentDelays.options}
				/>
			</div>

			<FadeContent
				delay={contentDelays.result}
				className={`w-full max-w-md mx-auto`}
			>
				{(() => {
					if (!player || !bets) return null;
					const playerBet = bets.find(
						(b) => b.player_id === player.id,
					);
					if (!playerBet || !prediction.winning_option_id)
						return null;
					if (playerBet.option_id === prediction.winning_option_id) {
						return (
							<Alert variant='success'>
								<BicepsFlexed className={`w-4 h-4 text-win`} />
								<AlertTitle>Congratulations!</AlertTitle>
								<AlertDescription>
									You won the prediction.
								</AlertDescription>
								<AlertAction>
									{playerBet.payout !== null && (
										<p
											className={`text-lg font-semibold ${playerBet.payout - playerBet.amount > 0 ? "text-win" : "text-loss"}`}
										>
											{playerBet.payout -
												playerBet.amount >
											0
												? "+"
												: ""}
											{(
												playerBet.payout -
												playerBet.amount
											).toLocaleString()}{" "}
											PTS
										</p>
									)}
								</AlertAction>
							</Alert>
						);
					} else {
						return (
							<Alert variant='destructive'>
								<FrownIcon className={`w-4 h-4 text-loss`} />
								<AlertTitle>Better luck next time!</AlertTitle>
								<AlertDescription>
									You lost the prediction.
								</AlertDescription>
								<AlertAction>
									{playerBet.payout !== null && (
										<p
											className={`text-lg font-semibold ${playerBet.payout - playerBet.amount > 0 ? "text-win" : "text-loss"}`}
										>
											{playerBet.payout -
												playerBet.amount >
											0
												? "+"
												: ""}
											{playerBet.payout -
												playerBet.amount}{" "}
											PTS
										</p>
									)}
								</AlertAction>
							</Alert>
						);
					}
				})()}
			</FadeContent>

			{shareData ? (
				<div className={`w-full max-w-md mx-auto flex justify-end`}>
					<ShareResultButton
						data={shareData}
						fileName={`verdict-${prediction.id.slice(0, 8)}`}
					/>
				</div>
			) : null}

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
					<FadeContent
						delay={contentDelays.payout}
						className={`rounded-xl overflow-hidden border border-border`}
					>
						{bets?.map((bet) => (
							<button
								key={bet.id}
								className={`flex justify-between border-b border-secondary bg-card hover:bg-secondary p-4 w-full`}
								onClick={() => {
									setSelectedPlayerId(bet.player_id);
									setIsProfileDialogOpen(true);
								}}
							>
								<div>
									<p
										className={`text-lg font-semibold text-left`}
									>
										{getPlayerName(bet.player_id)}
									</p>
									<p className={`text-sm text-left`}>
										<span
											className={`text-muted-foreground`}
										>
											{bet.amount.toLocaleString()}{" "}
											PTS{" "}
										</span>
										<span
											className={`text-sm text-right ${prediction.winning_option_id === bet.option_id ? "text-win" : "text-loss"}`}
										>
											on {bet.option?.label ?? "Unknown"}
										</span>
									</p>
								</div>
								<div className={`flex flex-col items-end`}>
									{bet.payout !== null && (
										<p
											className={`text-lg font-semibold ${bet.payout - bet.amount > 0 ? "text-win" : "text-loss"}`}
										>
											{bet.payout - bet.amount > 0
												? "+"
												: ""}
											{(
												bet.payout - bet.amount
											).toLocaleString()}{" "}
											PTS
										</p>
									)}
								</div>
							</button>
						))}
					</FadeContent>
				)}
			</div>

			<PlayerProfileDialog
				playerId={selectedPlayerId}
				open={isProfileDialogOpen}
				onOpenChange={setIsProfileDialogOpen}
				roomId={room.id}
			/>
		</div>
	);
}

export default ResolvedPhase;
