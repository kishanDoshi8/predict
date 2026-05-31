import React, { useEffect } from "react";
import { Slider } from "../../../components/ui/slider";
import { Button } from "../../../components/ui/button";
import {
	ChevronDown,
	Coins,
	MinusIcon,
	PlusIcon,
	RotateCcw,
	X,
} from "lucide-react";
import { Player } from "@/types";
import { useCancelBet, useMyBet, usePlaceBet } from "@/store/bet";
import { Spinner } from "../../../components/ui/spinner";
import { toast } from "sonner";
import { useRoomContext } from "../RoomLayout";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { localStorageKeys } from "@/store/_keys";

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
	const { data: myBet, isPending: isMyBetLoading } = useMyBet(
		room.id,
		predictionId,
		player.id,
	);
	const { mutate: cancelBet, isPending: isCancellingBet } = useCancelBet();

	const [betAmount, setBetAmount] = React.useState<number>(1);
	const [collapseControls, setCollapseControls] = useLocalStorage<boolean>(
		false,
		localStorageKeys.userPreference.bettingContorls.collapsed,
	);

	const availableBalance =
		player.points_balance - player.points_in_escrow + (myBet?.amount ?? 0);

	useEffect(() => {
		if (myBet) {
			setSelectedOption(myBet.option_id);
			setBetAmount(myBet.amount);
		} else {
			setBetAmount(1);
		}

		if (!myBet && !isMyBetLoading) {
			setCollapseControls(false);
		}
	}, [myBet, isMyBetLoading, setSelectedOption]);

	const handlePlaceBet = () => {
		if (!player || !predictionId || !selectedOption) return;

		placeBet(
			{
				roomId: room.id,
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

	const handleAddAmount = (number?: number) => {
		setBetAmount((prev) =>
			Math.min(prev + (number ?? 1), availableBalance),
		);
	};

	const handleSubtractAmount = () => {
		setBetAmount((prev) => Math.max(prev - 1, 1));
	};

	return (
		<div className={`relative p-4 border rounded-md bg-background`}>
			<Button
				variant={"secondary"}
				className={`absolute -top-1 left-1/2 -translate-x-1/2 bg-background hover:bg-background/80 data-[state=open]:bg-background/80 border rounded-lg rounded-tr-none rounded-tl-none`}
				size={"icon-lg"}
				disabled={!myBet}
				onClick={() =>
					setCollapseControls((prev) => (myBet ? !prev : prev))
				}
			>
				<ChevronDown
					className={`w-4 h-4 duration-300 ${collapseControls ? "rotate-180" : ""}`}
				/>
			</Button>
			<div
				className={`flex flex-col ${collapseControls ? "gap-2" : "gap-6"}`}
			>
				<div className={`flex justify-between items-center`}>
					{selectedOption && (
						<Button
							className={`flex-col gap-1 items-end p-2`}
							variant={"none"}
							onClick={handleResetBetAmount}
						>
							<p
								className={`flex items-center justify-start gap-2 text-xs text-muted-foreground text-left`}
							>
								{myBet && myBet.amount !== betAmount && (
									<RotateCcw className={`w-3! h-3!`} />
								)}
								Bet Amount
							</p>
							<p
								className={`text-win w-full text-left text-lg font-semibold`}
							>
								{myBet && myBet?.amount !== betAmount && (
									<span
										className={`text-xs text-muted-foreground`}
									>
										{myBet.amount - betAmount < 0 && "+"}
										{betAmount - (myBet.amount ?? 0)}{" "}
									</span>
								)}
								{betAmount} pts
							</p>
						</Button>
					)}
					<div>
						<p className={`text-xs text-muted-foreground`}>
							Your Balance
						</p>
						<p className={`${selectedOption ? "text-right" : ""}`}>
							<span className={`text-xl font-semibold`}>
								{availableBalance} pts
							</span>
						</p>
					</div>
				</div>
				{!collapseControls && (
					<>
						{selectedOption && (
							<div className={`flex flex-col gap-3`}>
								<div className={`flex gap-2 *:flex-1`}>
									<Button
										variant={"outline"}
										size={"sm"}
										onClick={() => handleAddAmount(5)}
										disabled={
											betAmount === availableBalance
										}
									>
										+5
									</Button>
									<Button
										variant={"outline"}
										size={"sm"}
										onClick={() => handleAddAmount(20)}
										disabled={
											betAmount === availableBalance
										}
									>
										+20
									</Button>
									<Button
										variant={"outline"}
										size={"sm"}
										onClick={() => handleAddAmount(50)}
										disabled={
											betAmount === availableBalance
										}
									>
										+50
									</Button>
									<Button
										variant={"outline"}
										size={"sm"}
										onClick={() => handleAddAmount(100)}
										disabled={
											betAmount === availableBalance
										}
									>
										+100
									</Button>
								</div>
								<div className={`flex gap-3 `}>
									<Button
										variant={"secondary"}
										size={"icon-sm"}
										onClick={handleSubtractAmount}
									>
										<MinusIcon className={`w-3 h-3`} />
									</Button>
									<Slider
										min={1}
										max={availableBalance}
										step={1}
										value={[betAmount]}
										onValueChange={(value) =>
											setBetAmount(value[0])
										}
										disabled={isPlacingBet}
									/>
									<Button
										variant={"secondary"}
										size={"icon-sm"}
										onClick={() => handleAddAmount()}
									>
										<PlusIcon className={`w-3 h-3`} />
									</Button>
								</div>
							</div>
						)}
					</>
				)}
				<div>
					{!collapseControls && (
						<>
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
										variant={"linear"}
										className={`flex-1`}
										disabled={
											isPlacingBet ||
											myBet.amount === betAmount
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
										variant={"secondary"}
										size={"lg"}
										onClick={() => setSelectedOption(null)}
									>
										<X />
									</Button>
									<Button
										variant={"linear"}
										size={"lg"}
										className={`flex-1`}
										onClick={handlePlaceBet}
										disabled={isPlacingBet}
									>
										{isPlacingBet ? <Spinner /> : <Coins />}
										Place Bet
									</Button>
								</div>
							)}
						</>
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
