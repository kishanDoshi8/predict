import { useActivePrediction } from "@/store/prediction";
import { useRoomContext } from "../RoomLayout";
import { Badge, Field, FieldLabel, Progress, Skeleton } from "@/components";
import { Countdown } from "../widgets/CountDown";
import { useBets } from "@/store/bet";
import { useOptionBgColor } from "@/hooks/useOptionColor";
import { DotIcon } from "lucide-react";
import { PingLoading } from "@/components/ui/spinner";
import { Link } from "react-router-dom";

function InPlayPredictions() {
	const { room } = useRoomContext();
	const { data: activePrediction, isPending: isPredictionLoading } =
		useActivePrediction(room.id);
	const { data: bets = [] } = useBets(room.id, activePrediction?.id);

	const betAmountPerOption: Record<string, number> = {};
	for (const bet of bets) {
		if (!betAmountPerOption[bet.option_id]) {
			betAmountPerOption[bet.option_id] = 0;
		}
		betAmountPerOption[bet.option_id] += bet.amount;
	}

	const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);

	return (
		<div>
			{isPredictionLoading && (
				<div className={`flex flex-col gap-4  my-4`}>
					<Skeleton className={`h-8 w-25`} />
				</div>
			)}
			{activePrediction?.status === "draft" && (
				<h2 className={`my-4 text-lg font-semibold`}>In Play</h2>
			)}
			{activePrediction?.status === "locked" && (
				<h2
					className={`my-4 flex items-center gap-2 text-lg font-semibold`}
				>
					<PingLoading className={`inline-block`} />
					Live
				</h2>
			)}
			{activePrediction?.status === "revealed" && (
				<h2
					className={`my-4 flex items-center gap-2 text-lg font-semibold`}
				>
					<DotIcon
						className={`inline-block text-green-500 animate-pulse`}
					/>
					Resolved
				</h2>
			)}

			<div
				className={`border-2 border-cyan-900 rounded-xl p-4 flex flex-col gap-2 bg-secondary text-accent-foreground w-full transition-colors`}
			>
				{activePrediction ? (
					<Link
						to={`predictions/${activePrediction.id}`}
						className={`no-underline`}
					>
						<h4 className={`text-xl md:text-2xl`}>
							{activePrediction.title}
						</h4>

						<div className={`mt-2`}>
							{activePrediction?.deadline &&
								activePrediction.status === "draft" && (
									<Countdown
										targetTime={new Date(
											activePrediction.deadline,
										).getTime()}
									/>
								)}
						</div>

						<div className={`flex flex-col gap-4 mt-6`}>
							{activePrediction.prediction_options.map(
								(option) => (
									<Field
										className='w-full max-w-sm'
										key={option.id}
									>
										<FieldLabel
											htmlFor={`progress-upload-${option.id}`}
										>
											<span>
												{option.label}
												{/* hot pick label if +60% */}
												{totalBetAmount > 0 &&
												(betAmountPerOption[option.id] /
													totalBetAmount) *
													100 >=
													60 ? (
													<Badge
														variant='outline'
														className='ml-2 text-xs'
													>
														🔥 hot pick
													</Badge>
												) : null}
											</span>
											<span className='ml-auto'>
												{totalBetAmount
													? `${Math.round(
															(betAmountPerOption[
																option.id
															] /
																totalBetAmount) *
																100,
														)}%`
													: "0%"}
											</span>
										</FieldLabel>
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
											className={
												false
													? "[&>div]:bg-slate-400 bg-slate-400/50"
													: `[&>div]:${useOptionBgColor(option.id)}`
											}
											id={`progress-upload-${option.id}`}
										/>
									</Field>
								),
							)}
						</div>

						<div>
							{activePrediction?.status === "draft" && (
								<span
									className={`text-sm text-muted-foreground text-right mt-4 block`}
								>
									Place your bets now!
								</span>
							)}
						</div>
					</Link>
				) : (
					<div className={`flex flex-col gap-4 justify-center`}>
						<Skeleton className={`h-6 mx-auto w-full`} />
						<Skeleton className={`h-10 mx-auto w-full`} />
						<Skeleton className={`h-10 mx-auto w-full`} />
					</div>
				)}
			</div>
		</div>
	);
}

export default InPlayPredictions;
