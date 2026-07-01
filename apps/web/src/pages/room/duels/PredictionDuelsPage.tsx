import { Badge, Button, Skeleton } from "@/components";
import { usePredictionDuelRealtime } from "@/hooks/useRoomRealtime";
import { useBets } from "@/store/bet";
import { usePredictionDuels } from "@/store/duel";
import { usePrediction } from "@/store/prediction";
import { useRoomContext } from "../RoomLayout";
import { Link, useParams } from "react-router-dom";
import { Duel } from "@/types";
import { DuelCard } from "./components/DuelCard";

function getPredictionStatusLabel(status?: string) {
	if (status === "draft") return "Live";
	if (status === "locked") return "Locked";
	return "Resolved";
}

export function PredictionDuelsPage() {
	const { predictionId } = useParams<{ predictionId: string }>();
	const { room } = useRoomContext();

	const { data: prediction, isPending: isPredictionLoading } = usePrediction(
		room.id,
		predictionId,
	);
	const { data: duels = [], isPending: isDuelsLoading } = usePredictionDuels(
		room.id,
		predictionId,
	);
	const { data: bets = [] } = useBets(room.id, predictionId);

	usePredictionDuelRealtime(room.id, predictionId ?? null);

	const getPlayerLabel = (playerId: string | null) => {
		if (!playerId) return null;
		return (
			room.members.find((member) => member.player_id === playerId)?.player
				.username ?? "Unknown player"
		);
	};

	const getOutcomeLabel = (duel: Duel) => {
		if (duel.status !== "resolved") return null;
		if (!prediction || prediction.status !== "revealed") {
			return "No winner (prediction did not reveal a winning option)";
		}

		const challengerBet = bets.find((bet) => bet.id === duel.challenger_bet_id);
		const opponentBet = bets.find(
			(bet) => bet.id === duel.matched_opponent_bet_id,
		);

		if (!challengerBet || !opponentBet || !prediction.winning_option_id) {
			return "Resolved";
		}

		if (challengerBet.option_id === prediction.winning_option_id) {
			return `${getPlayerLabel(duel.challenger_player_id) ?? "Challenger"} won`;
		}

		return `${getPlayerLabel(duel.matched_opponent_player_id) ?? "Opponent"} won`;
	};

	const isDuelOpen = prediction?.status === "draft";

	return (
		<div className='max-w-md mx-auto px-4 pb-6 space-y-4'>
			<div className='rounded-xl border border-border bg-card p-4 space-y-2'>
				<div className='flex items-center justify-between'>
					<h2 className='text-2xl font-semibold'>Duels</h2>
					<Badge variant={isDuelOpen ? "default" : "secondary"}>
						{isDuelOpen ? "Active" : "Closed"}
					</Badge>
				</div>
				<p className='text-sm text-muted-foreground'>
					Challenge other players using your prediction bets.
				</p>
				<p className='text-sm'>
					<span className='text-muted-foreground'>Prediction status:</span>{" "}
					{isPredictionLoading
						? "Loading..."
						: getPredictionStatusLabel(prediction?.status)}
				</p>
				<div>
					<Button asChild size='sm' disabled={!isDuelOpen}>
						<Link to='create'>Create Duel</Link>
					</Button>
				</div>
			</div>

			<section className='space-y-3'>
				<h3 className='text-lg font-semibold'>Duel List</h3>
				{isDuelsLoading ? (
					<>
						<Skeleton className='h-32 w-full' />
						<Skeleton className='h-32 w-full' />
					</>
				) : duels.length === 0 ? (
					<div className='rounded-xl border border-border bg-card p-4'>
						<p className='text-sm text-muted-foreground'>
							No duels yet for this prediction.
						</p>
					</div>
				) : (
					duels.map((duel) => (
						<DuelCard
							key={duel.id}
							duel={duel}
							challengerLabel={
								duel.status === "created" || duel.status === "queued"
									? "Anonymous Challenger"
									: (getPlayerLabel(duel.challenger_player_id) ??
										"Unknown")
							}
							opponentLabel={getPlayerLabel(
								duel.matched_opponent_player_id,
							)}
							outcomeLabel={getOutcomeLabel(duel)}
						/>
					))
				)}
			</section>
		</div>
	);
}
