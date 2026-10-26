import {
	FadeContent,
	Field,
	FieldContent,
	FieldLabel,
	FieldTitle,
	Progress,
	RadioGroup,
	RadioGroupItem,
	Skeleton,
} from "@/shared/ui";
import { useBets } from "@/features/predictions";
import { Prediction } from "@/features/predictions";
import React from "react";
import { useRoomContext } from "@/app/layouts/RoomLayout";
import { useOptionColor } from "@/shared/hooks/useOptionColor";

type Props = {
	prediction: Prediction | null | undefined;
	selectedOption: string | null;
	setSelectedOption: React.Dispatch<React.SetStateAction<string | null>>;
	fadeDelay?: number;
};

export default function PredictionOptions({
	prediction,
	selectedOption,
	setSelectedOption,
	fadeDelay,
}: Readonly<Props>) {
	const { room } = useRoomContext();
	const { data: bets = [], isPending: isBetsPending } = useBets(
		room.id,
		prediction?.id,
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
			{/* Wait for bets too, so percentages don't jump from 0%. */}
			{prediction && !isBetsPending ? (
				<FadeContent delay={fadeDelay} className={`w-full`}>
					<RadioGroup
						className={`mt-4`}
						value={selectedOption}
						onValueChange={setSelectedOption}
						// A placed bet can switch to another option until the deadline.
						disabled={prediction.status !== "draft"}
					>
						{prediction.prediction_options.map((option) => (
							<FieldLabel
								key={option.id}
								className={`flex items-center gap-2 cursor-pointer bg-background ${prediction.winning_option_id === option.id ? "border-win" : ""} `}
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
											{(() => {
												let optionTextClass = "";
												if (
													prediction.winning_option_id
												) {
													optionTextClass =
														prediction.winning_option_id ===
														option.id
															? "text-win"
															: "text-loss";
												} else {
													optionTextClass =
														useOptionColor(
															option.id,
														);
												}
												return (
													<p
														className={`flex flex-col`}
													>
														<span
															className={`text-lg text-right ${optionTextClass}`}
														>
															{totalBetAmount
																? (
																		((betAmountPerOption[
																			option
																				.id
																		] ??
																			0) /
																			totalBetAmount) *
																		100
																	).toFixed(0)
																: 0}
															%
														</span>
														<span
															className={`text-xs text-muted-foreground text-right`}
														>
															{(
																betAmountPerOption[
																	option.id
																] ?? 0
															).toLocaleString()}{" "}
															pts
														</span>
													</p>
												);
											})()}
										</FieldTitle>
										{/* A div, not FieldDescription (<p>): Progress renders block elements. */}
										<div className='w-full'>
											{prediction.winning_option_id ? (
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
													className={`${prediction.winning_option_id === option.id ? "bg-win/30" : "bg-muted-foreground/50"}`}
													indicatorBgClassName={`${option.id === prediction.winning_option_id ? "bg-win" : "bg-muted-foreground"} `}
												/>
											) : (
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
													className={`${selectedOption !== option.id && "[&>div]:bg-muted-foreground bg-muted-foreground/50"}`}
												/>
											)}
										</div>
									</FieldContent>
								</Field>
							</FieldLabel>
						))}
					</RadioGroup>
				</FadeContent>
			) : (
				<PredictionOptionsSkeleton
					count={prediction?.prediction_options.length ?? 2}
				/>
			)}
		</>
	);
}

// Stands in for the option cards: label, amount and bar, one per option.
export function PredictionOptionsSkeleton({
	count = 2,
}: Readonly<{ count?: number }>) {
	return (
		<div
			aria-hidden='true'
			className={`max-w-md w-full mx-auto mt-4 flex flex-col gap-3`}
		>
			{Array.from({ length: count }).map((_, i) => (
				<div key={i} className={`rounded-lg border p-4 flex gap-3`}>
					<Skeleton className={`size-4 rounded-full mt-1`} />
					<div className={`flex-1 flex flex-col gap-2`}>
						<div className={`flex justify-between`}>
							<Skeleton className={`h-6 w-28`} />
							<Skeleton className={`h-5 w-10`} />
						</div>
						<Skeleton className={`h-3 w-16 ml-auto`} />
						<Skeleton className={`h-2 w-full`} />
					</div>
				</div>
			))}
		</div>
	);
}
