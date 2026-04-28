import React, { useEffect } from "react";
import { Slider } from "../../../components/ui/slider";
import { Button } from "../../../components/ui/button";
import { Coins, X } from "lucide-react";
import { Player } from "@/types";
import { useCancelBet, useMyBet, usePlaceBet } from "@/store/bet";
import { playerToken } from "@/store/player";
import { Spinner } from "../../../components/ui/spinner";
import { toast } from "sonner";
import { useRoomContext } from "../RoomLayout";

type Props = {
	player: Player;
	predictionId: string;
	selectedOption: string | null;
	setSelectedOption: React.Dispatch<React.SetStateAction<string | null>>;
};

export default function DraftControls({
	player,
	predictionId,
	selectedOption,
	setSelectedOption,
}: Readonly<Props>) {
	const { room } = useRoomContext();
	const { mutate: placeBet, isPending: isPlacingBet } = usePlaceBet();
	const { data: myBet } = useMyBet(room.id, predictionId, player.id);
	const { mutate: cancelBet, isPending: isCancellingBet } = useCancelBet();

	const [betAmount, setBetAmount] = React.useState<number>(1);

	const availableBalance =
		player.points_balance - player.points_in_escrow + (myBet?.amount ?? 0);

	useEffect(() => {
		if (myBet) {
			setSelectedOption(myBet.option_id);
			setBetAmount(myBet.amount);
		} else {
			setBetAmount(1);
		}
	}, [myBet]);

	const handlePlaceBet = () => {
		if (!player || !predictionId || !selectedOption) return;

		placeBet(
			{
				roomId: room.id,
				playerToken: playerToken,
				playerId: player.id,
				predictionId: predictionId,
				optionId: selectedOption,
				amount: betAmount,
			},
			{
				onError: (error) => {
					console.error("Failed to place bet:", error);
					toast.error("Failed to place bet. Please try again.", {
						position: "top-center",
						description: error.message,
					});
				},
			},
		);
	};

	const handleResetBetAmount = () => {
		if (myBet) {
			setBetAmount(myBet.amount);
		} else {
			setBetAmount(1);
		}
	};

	const handleCancelBet = () => {
		if (!player || !predictionId) return;
		cancelBet(
			{
				roomId: room.id,
				playerToken: playerToken,
				playerId: player.id,
				predictionId: predictionId,
			},
			{
				onError: (error) => {
					console.error("Failed to cancel bet:", error);
					toast.error("Failed to cancel bet.", {
						position: "top-center",
						description:
							error instanceof Error ? error.message : undefined,
					});
				},
			},
		);
	};

	return (
		<div className={`p-4 border rounded-md bg-background`}>
			<div className={`flex flex-col gap-6`}>
				<div className={`flex justify-between items-center`}>
					<div>
						<p className={`text-xs text-muted-foreground`}>
							Your Balance
						</p>
						<p>{availableBalance} pts</p>
					</div>
					{selectedOption && (
						<Button
							className={`flex-col gap-1 items-end p-2`}
							variant={"ghost"}
							onClick={handleResetBetAmount}
						>
							<p
								className={`text-xs text-muted-foreground text-right`}
							>
								Bet Amount
							</p>
							<p className={`text-primary`}>
								{myBet && myBet?.amount !== betAmount && (
									<span
										className={`text-xs text-muted-foreground`}
									>
										{myBet.amount - betAmount < 0 && "+"}
										{betAmount - (myBet.amount ?? 0)}
									</span>
								)}{" "}
								{betAmount} pts
							</p>
						</Button>
					)}
				</div>
				{selectedOption && (
					<Slider
						min={1}
						max={availableBalance}
						step={1}
						value={[betAmount]}
						onValueChange={(value) => setBetAmount(value[0])}
						disabled={isPlacingBet}
					/>
				)}
				<div>
					{myBet && (
						<div className={`flex gap-4`}>
							<Button
								variant={"outline"}
								className={`flex-1`}
								disabled={isCancellingBet}
								onClick={handleCancelBet}
							>
								{isCancellingBet && <Spinner />}
								Cancel Bet
							</Button>
							<Button
								variant={"secondary"}
								className={`flex-1`}
								disabled={
									isPlacingBet || myBet.amount === betAmount
								}
								onClick={handlePlaceBet}
							>
								{isPlacingBet && <Spinner />}
								Update Bet
							</Button>
						</div>
					)}
					{selectedOption && !myBet && (
						<div className={`flex gap-2 mt-2`}>
							<Button
								variant={"destructive"}
								onClick={() => setSelectedOption(null)}
							>
								<X />
							</Button>
							<Button
								className={`flex-1`}
								onClick={handlePlaceBet}
								disabled={isPlacingBet}
							>
								{isPlacingBet && <Spinner />}
								Place Bet
								<Coins fill='black' />
							</Button>
						</div>
					)}
					{selectedOption && !myBet && (
						<p className={`text-xs text-muted-foreground mt-2`}>
							Bets are locked and cannot be changed after the
							deadline
						</p>
					)}
					{!selectedOption && !myBet && (
						<p className={`text-xs text-muted-foreground mt-2`}>
							Select an option and place your bet before the
							deadline
						</p>
					)}
					{myBet && (
						<p className={`text-xs text-muted-foreground mt-2`}>
							You can update your bet or cancel to change options
							before the deadline.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
