import { Button, Input, Spinner } from "@/components";
import { useCreateDuel } from "@/store/duel";
import { usePrediction } from "@/store/prediction";
import { usePlayer } from "@/store/player";
import { useRoomContext } from "../RoomLayout";
import { useMyBet } from "@/store/bet";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const PRESET_STAKES = [100, 200, 300, 500, 1000];
const MIN_DUEL_STAKE = 100;

function getDuelFee(stakeAmount: number) {
	return Math.max(Math.ceil(stakeAmount * 0.02), 5);
}

export function PredictionDuelCreatePage() {
	const { predictionId } = useParams<{ predictionId: string }>();
	const navigate = useNavigate();
	const { room } = useRoomContext();

	const { data: prediction } = usePrediction(room.id, predictionId);
	const { data: player } = usePlayer();
	const { data: myBet } = useMyBet(room.id, predictionId ?? "", player?.id ?? "");
	const { mutate: createDuel, isPending: isCreatingDuel } = useCreateDuel();

	const [stakeAmount, setStakeAmount] = useState<number>(MIN_DUEL_STAKE);

	const availableBalance = useMemo(() => {
		if (!player) return 0;
		return player.points_balance - player.points_in_escrow + (myBet?.amount ?? 0);
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
					navigate(`/rooms/${room.code}/predictions/${predictionId}/duels`);
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
		<div className='max-w-md mx-auto px-4 pb-6 space-y-4'>
			<div className='rounded-xl border border-border bg-card p-4 space-y-2'>
				<h2 className='text-2xl font-semibold'>Create Duel</h2>
				<p className='text-sm text-muted-foreground'>
					You will be matched with the first valid opponent.
				</p>
			</div>

			<div className='rounded-xl border border-border bg-card p-4 space-y-3'>
				<p className='text-sm'>
					<span className='text-muted-foreground'>Your bet:</span>{" "}
					{myBet ? `${myBet.amount.toLocaleString()} PTS` : "No valid bet"}
				</p>
				<p className='text-sm'>
					<span className='text-muted-foreground'>Available balance:</span>{" "}
					{availableBalance.toLocaleString()} PTS
				</p>
				<p className='text-sm'>
					<span className='text-muted-foreground'>Maximum duel stake:</span>{" "}
					{maxStakeFromBet.toLocaleString()} PTS
				</p>

				<div className='space-y-2'>
					<p className='text-sm font-medium'>Stake amount</p>
					<div className='flex flex-wrap gap-2'>
						{PRESET_STAKES.map((presetStake) => (
							<Button
								key={presetStake}
								type='button'
								size='sm'
								variant={
									stakeAmount === presetStake ? "default" : "outline"
								}
								disabled={presetStake > maxStakeFromBet}
								onClick={() => setStakeAmount(presetStake)}
							>
								{presetStake}
							</Button>
						))}
					</div>
					<Input
						type='number'
						min={MIN_DUEL_STAKE}
						step={100}
						value={stakeAmount}
						onChange={(event) =>
							setStakeAmount(Number(event.target.value || 0))
						}
					/>
				</div>

				<div className='rounded-lg border border-border bg-background p-3 space-y-2 text-sm'>
					<p>
						<span className='text-muted-foreground'>Confidence cost (fee):</span>{" "}
						{feeAmount} PTS
					</p>
					<p>
						<span className='text-muted-foreground'>Escrow reserve:</span>{" "}
						{stakeAmount} PTS
					</p>
					<p className='text-muted-foreground'>
						Your stake points are reserved in escrow while the duel is
						active.
					</p>
				</div>

				<div className='rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground'>
					Opponent selection: OPEN (V1)
				</div>

				{!isPredictionOpen && (
					<p className='text-sm text-loss'>
						Duel creation is closed because this prediction is no longer
						live.
					</p>
				)}
				{!hasValidBet && (
					<p className='text-sm text-loss'>
						You need a valid prediction bet of at least 100 points to create
						a duel.
					</p>
				)}
				{stakeAmount < MIN_DUEL_STAKE && (
					<p className='text-sm text-loss'>
						Minimum duel stake is {MIN_DUEL_STAKE} points.
					</p>
				)}
				{!canAffordStake && (
					<p className='text-sm text-loss'>
						Insufficient available balance for stake + confidence fee.
					</p>
				)}

				<div className='flex gap-2'>
					<Button
						variant='outline'
						className='flex-1'
						onClick={() =>
							navigate(
								`/rooms/${room.code}/predictions/${predictionId}/duels`,
							)
						}
					>
						Cancel
					</Button>
					<Button
						className='flex-1'
						onClick={onCreateDuel}
						disabled={isCreateDisabled || isCreatingDuel}
					>
						{isCreatingDuel && <Spinner />}
						Create Duel
					</Button>
				</div>
			</div>
		</div>
	);
}
