import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
	Button,
	Spinner,
} from "@/shared/ui";
import { useCreateDuel, usePredictionDuelSummary } from "@/entities/duel/hooks/duel";
import { usePrediction } from "@/entities/prediction/hooks/prediction";
import { usePlayer } from "@/entities/player/hooks/player";
import { useRoomContext } from "@/app/layouts/RoomLayout";
import { useMyBet } from "@/entities/prediction/hooks/bet";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
	InfoIcon,
	MinusIcon,
	PlusIcon,
	ShieldIcon,
	ShieldXIcon,
	UsersIcon,
} from "lucide-react";
import { StakeBreakdown } from "@/features/duel-details/pages/PredictionDuelDetailPage";

const MIN_DUEL_STAKE = 100;

function getDuelFee(stakeAmount: number) {
	return Math.max(Math.ceil(stakeAmount * 0.02), 5);
}

export function PredictionDuelCreatePage() {
	const { predictionId } = useParams<{ predictionId: string }>();
	const navigate = useNavigate();
	const { room } = useRoomContext();

	const { data: prediction } = usePrediction(room.id, predictionId);
	const { data: duelSummary } = usePredictionDuelSummary(
		room.id,
		predictionId,
	);
	const { data: player } = usePlayer();
	const { data: myBet } = useMyBet(
		room.id,
		predictionId ?? "",
		player?.id ?? "",
	);
	const { mutate: createDuel, isPending: isCreatingDuel } = useCreateDuel();

	const [stakeAmount, setStakeAmount] = useState<number>(MIN_DUEL_STAKE);

	const availableBalance = useMemo(() => {
		if (!player) return 0;
		return (
			player.points_balance -
			player.points_in_escrow +
			(myBet?.amount ?? 0)
		);
	}, [myBet?.amount, player]);

	const maxStakeFromBet = myBet?.amount ?? 0;
	const feeAmount = getDuelFee(stakeAmount);
	const canAffordStake = availableBalance >= stakeAmount + feeAmount;

	const isPredictionOpen = prediction?.status === "draft";
	const hasValidBet = !!myBet && myBet.amount >= MIN_DUEL_STAKE;
	const isStakeValid =
		stakeAmount >= MIN_DUEL_STAKE &&
		stakeAmount <= maxStakeFromBet &&
		stakeAmount % 100 === 0 &&
		canAffordStake;

	const isCreateDisabled =
		!predictionId ||
		!player ||
		!myBet ||
		!isPredictionOpen ||
		!(duelSummary?.currentPlayerCanCreate ?? true) ||
		!hasValidBet ||
		!isStakeValid;

	const onCreateDuel = () => {
		if (!predictionId || !player || !myBet) return;

		createDuel(
			{
				roomId: room.id,
				predictionId,
				challengerPlayerId: player.id,
				betId: myBet.id,
				stakeAmount,
			},
			{
				onSuccess: () => {
					toast.success("Duel created.");
					navigate(
						`/rooms/${room.code}/predictions/${predictionId}/duels`,
						{ replace: true },
					);
				},
				onError: (error) => {
					toast.error("Failed to create duel.", {
						description: error.message,
					});
				},
			},
		);
	};

	return (
		<div className='max-w-md mx-auto px-4 pb-6 pt-4 space-y-4'>
			{!isCreateDisabled && (
				<Alert>
					<ShieldIcon color={"var(--accent)"} />
					<AlertTitle>Your pick stays hidden</AlertTitle>
					<AlertDescription>
						Revealed only when the match locks. No one sees your
						side.
					</AlertDescription>
				</Alert>
			)}

			{!isPredictionOpen && (
				<Alert variant='destructive'>
					<ShieldXIcon color={"var(--loss)"} />
					<AlertTitle>Too late for this duel</AlertTitle>
					<AlertDescription>
						This matchup has already locked.
					</AlertDescription>
				</Alert>
			)}
			{!hasValidBet && (
				<Alert variant='destructive'>
					<ShieldXIcon color={"var(--loss)"} />
					<AlertTitle>You need a stronger pick</AlertTitle>
					<AlertDescription>
						<p className='text-sm text-loss mb-2'>
							Place at least 100 points to start a duel.
						</p>
						<Button
							variant='secondary'
							size='sm'
							onClick={() =>
								navigate(
									`/rooms/${room.code}/predictions/${predictionId}`,
									{ replace: true },
								)
							}
						>
							Place a bet
						</Button>
					</AlertDescription>
					<AlertAction></AlertAction>
				</Alert>
			)}
			{stakeAmount < MIN_DUEL_STAKE && (
				<Alert variant='destructive'>
					<ShieldXIcon color={"var(--loss)"} />
					<AlertTitle>Raise the challenge amount</AlertTitle>
					<AlertDescription>
						<p className='text-sm text-loss'>
							Make it at least {MIN_DUEL_STAKE} points.
						</p>
					</AlertDescription>
				</Alert>
			)}
			{!canAffordStake && (
				<Alert variant='destructive'>
					<ShieldXIcon color={"var(--loss)"} />
					<AlertTitle>Not enough points</AlertTitle>
					<AlertDescription>
						<p className='text-sm text-loss'>
							You don’t have enough for the stake and fee.
						</p>
					</AlertDescription>
				</Alert>
			)}

			<div className='rounded-xl border border-border bg-card p-4 space-y-3'>
				<div
					className={`flex flex-col items-center justify-center gap-4`}
				>
					<h2>Challenge Amount</h2>
					<div className={`flex gap-4`}>
						<Button
							size='icon-lg'
							variant='secondary'
							disabled={stakeAmount <= MIN_DUEL_STAKE}
							onClick={() =>
								setStakeAmount((prev) =>
									Math.max(prev - 100, MIN_DUEL_STAKE),
								)
							}
						>
							<MinusIcon className='h-4 w-4' />
						</Button>
						<p
							className={`flex flex-col items-center justify-center`}
						>
							<span className={`text-5xl font-bold text-primary`}>
								{stakeAmount}
							</span>
							<span className={`text-sm`}>POINTS</span>
						</p>
						<Button
							size='icon-lg'
							variant='secondary'
							disabled={stakeAmount >= maxStakeFromBet}
							onClick={() =>
								setStakeAmount((prev) =>
									Math.min(prev + 100, maxStakeFromBet),
								)
							}
						>
							<PlusIcon className='h-4 w-4' />
						</Button>
					</div>
					<div
						className={`flex gap-2 justify-around *:flex-1 flex-wrap w-full`}
					>
						<Button
							variant={
								stakeAmount === 100 ? "default" : "secondary"
							}
							disabled={maxStakeFromBet < 100}
							className={`border`}
							onClick={() => setStakeAmount(100)}
						>
							100
						</Button>
						<Button
							variant={
								stakeAmount === 200 ? "default" : "secondary"
							}
							disabled={maxStakeFromBet < 200}
							className={`border`}
							onClick={() => setStakeAmount(200)}
						>
							200
						</Button>
						<Button
							variant={
								stakeAmount === 300 ? "default" : "secondary"
							}
							disabled={maxStakeFromBet < 300}
							className={`border`}
							onClick={() => setStakeAmount(300)}
						>
							300
						</Button>
						<Button
							variant={
								stakeAmount === maxStakeFromBet
									? "default"
									: "secondary"
							}
							disabled={maxStakeFromBet < 500}
							className={`border`}
							onClick={() => setStakeAmount(maxStakeFromBet)}
						>
							MAX
						</Button>
					</div>
					<div>
						<InfoIcon
							className={`inline-block h-3 w-3 mr-2 text-muted-foreground`}
						/>
						<span className={`text-xs text-muted-foreground`}>
							Multiples of 100 · max = your bet ({maxStakeFromBet}
							)
						</span>
					</div>
				</div>
			</div>

			<StakeBreakdown
				stake={stakeAmount}
				fee={feeAmount}
				pot={stakeAmount}
			/>

			<Alert className={`mb-20`}>
				<UsersIcon color={"var(--primary)"} />
				<AlertDescription>
					Players queue to face you. After the prediction locks, the{" "}
					<span
						className={`text-foreground inline-flex font-semibold`}
					>
						first with a different pick
					</span>{" "}
					becomes your opponent — everyone else is refunded
					automatically.
				</AlertDescription>
			</Alert>

			{/* Footer */}
			<div className='flex gap-2 fixed inset-x-0 bottom-0 z-50 p-4 bg-card'>
				<Button
					variant='outline'
					className='flex-1'
					disabled={isCreatingDuel || isCreateDisabled}
					onClick={() =>
						navigate(
							`/rooms/${room.code}/predictions/${predictionId}/duels`,
							{ replace: true },
						)
					}
				>
					Cancel
				</Button>
				<Button
					className='flex-1'
					variant='linear'
					onClick={onCreateDuel}
					disabled={isCreateDisabled || isCreatingDuel}
				>
					{isCreatingDuel && <Spinner />}
					Create Duel
				</Button>
			</div>
		</div>
	);
}
