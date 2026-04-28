import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldTitle,
	Progress,
	RadioGroup,
	RadioGroupItem,
	Skeleton,
} from "@/components";
import { useBets, useMyBet } from "@/store/bet";
import { Prediction } from "@/types";
import React from "react";
import { useRoomContext } from "../RoomLayout";
import { usePlayer } from "@/store/player";
import { useOptionColor } from "@/hooks/useOptionColor";

type Props = {
	prediction: Prediction | null | undefined;
	selectedOption: string | null;
	setSelectedOption: React.Dispatch<React.SetStateAction<string | null>>;
};

export default function PredictionOptions({
	prediction,
	selectedOption,
	setSelectedOption,
}: Readonly<Props>) {
	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const { data: bets = [] } = useBets(room.id, prediction?.id);
	const { data: myBet } = useMyBet(
		room.id,
		prediction?.id ?? "",
		player?.id ?? "",
	);

	// totalBetAmount per option
	const betAmountPerOption: Record<string, number> = {};
	for (const bet of bets) {
		if (!betAmountPerOption[bet.option_id]) {
			betAmountPerOption[bet.option_id] = 0;
		}
		betAmountPerOption[bet.option_id] += bet.amount;
	}

	const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);

	return (
		<>
			{prediction ? (
				<RadioGroup
					className={`w-full mt-4`}
					value={selectedOption}
					onValueChange={setSelectedOption}
					disabled={prediction.status !== "draft" || !!myBet}
				>
					{prediction.prediction_options.map((option) => (
						<FieldLabel
							key={option.id}
							className={`flex items-center gap-2 cursor-pointer ${prediction.winning_option_id === option.id ? "border-primary" : ""} `}
						>
							<Field orientation={"horizontal"}>
								<RadioGroupItem
									value={option.id}
									id={option.id}
								/>
								<FieldContent>
									<FieldTitle
										className={`w-full flex justify-between items-start`}
									>
										<span className={`text-lg`}>
											{option.label}
										</span>
										<p className={`flex flex-col`}>
											<span
												className={`text-lg text-right ${useOptionColor(option.id)}`}
											>
												{totalBetAmount
													? (((betAmountPerOption[option.id] ?? 0) / totalBetAmount) * 100).toFixed(0)
													: 0}
												%
											</span>
											<span
												className={`text-xs text-muted-foreground text-right`}
											>
												{betAmountPerOption[
													option.id
												] ?? 0}{" "}
												pts
											</span>
										</p>
									</FieldTitle>
									<FieldDescription>
										<Progress
											value={
												totalBetAmount
													? (betAmountPerOption[
															option.id
														] /
															totalBetAmount) *
														100
													: 0
											}
											className={`${selectedOption !== option.id && "[&>div]:bg-slate-400 bg-slate-400/50"} `}
										/>
									</FieldDescription>
								</FieldContent>
							</Field>
						</FieldLabel>
					))}
				</RadioGroup>
			) : (
				<div
					className={`max-w-md w-full mx-auto mt-4 flex flex-col gap-4`}
				>
					<Skeleton className={`h-16 min-w-lg mx-auto w-full`} />
					<Skeleton className={`h-16 min-w-lg mx-auto w-full`} />
				</div>
			)}
		</>
	);
}
