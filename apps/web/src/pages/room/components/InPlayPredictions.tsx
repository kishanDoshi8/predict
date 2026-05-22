import { useActivePredictions } from "@/store/prediction";
import { useRoomContext } from "../RoomLayout";
import {
	Badge,
	Field,
	FieldLabel,
	Progress,
	Skeleton,
	PingLoading,
} from "@/components";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";
import { Countdown } from "../widgets/CountDown";
import { useBets } from "@/store/bet";
import { useOptionBgColor } from "@/hooks/useOptionColor";
import { DotIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Prediction } from "@/types";

// Threshold (as a percentage) above which an option is labelled "🔥 hot pick"
const HOT_PICK_THRESHOLD_PERCENT = 60;

// ── Per-card component ─────────────────────────────────────────────────────
// Fetches its own bets so each card in the carousel is self-contained.
function PredictionCard({ prediction, roomId }: { prediction: Prediction; roomId: string }) {
	const { data: bets = [] } = useBets(roomId, prediction.id);

	const betAmountPerOption: Record<string, number> = {};
	for (const bet of bets) {
		betAmountPerOption[bet.option_id] = (betAmountPerOption[bet.option_id] ?? 0) + bet.amount;
	}
	const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);

	const isActive = prediction.status === "draft" || prediction.status === "locked";

	return (
		<div
			className={`border-2 rounded-xl p-4 flex flex-col gap-2 bg-secondary text-accent-foreground w-full transition-colors ${
				prediction.status === "locked"
					? "border-orange-600"
					: isActive
					? "border-cyan-900"
					: "border-border"
			}`}
		>
			<Link to={`predictions/${prediction.id}`} className={`no-underline`}>
				{/* Status badge per card */}
				<div className={`flex items-center gap-2 mb-2`}>
					{prediction.status === "draft" && (
						<>
							<Badge variant='outline' className={`border-accent text-primary text-xs`}>
								In Play
							</Badge>
							{prediction.deadline && (
								<Countdown targetTime={new Date(prediction.deadline).getTime()} />
							)}
						</>
					)}
					{prediction.status === "locked" && (
						<Badge variant='outline' className={`border-orange-600 text-orange-500 text-xs flex items-center gap-1`}>
							<PingLoading className={`inline-block`} />
							Live
						</Badge>
					)}
					{prediction.status === "revealed" && (
						<Badge variant='outline' className={`text-green-500 text-xs flex items-center gap-1`}>
							<DotIcon className={`text-green-500`} />
							Resolved
						</Badge>
					)}
					{prediction.status === "cancelled" && (
						<Badge variant='outline' className={`text-muted-foreground text-xs flex items-center gap-1`}>
							<DotIcon className={`text-muted-foreground`} />
							Cancelled
						</Badge>
					)}
					{prediction.status === "no_result" && (
						<Badge variant='outline' className={`text-muted-foreground text-xs flex items-center gap-1`}>
							<DotIcon className={`text-muted-foreground`} />
							No Result
						</Badge>
					)}
				</div>

				<h4 className={`text-xl md:text-2xl`}>{prediction.title}</h4>

				<div className={`flex flex-col gap-4 mt-6`}>
					{prediction.prediction_options.map((option) => (
						<Field className='w-full' key={option.id}>
							<FieldLabel htmlFor={`progress-${option.id}`}>
								<span>
									{option.label}
									{/* hot pick label when one option captures HOT_PICK_THRESHOLD_PERCENT% or more of bets */}
									{totalBetAmount > 0 &&
									(betAmountPerOption[option.id] / totalBetAmount) * 100 >= HOT_PICK_THRESHOLD_PERCENT ? (
										<Badge variant='outline' className='ml-2 text-xs'>
											🔥 hot pick
										</Badge>
									) : null}
								</span>
								<span className={`ml-auto`}>
									{betAmountPerOption[option.id] ?? 0} pts
								</span>
							</FieldLabel>
							<Progress
								value={
									totalBetAmount
										? (betAmountPerOption[option.id] / totalBetAmount) * 100
										: 0
								}
								// NOTE: useOptionBgColor is NOT a React hook despite its name —
								// it contains no React hook calls and is safe to use inside .map()
								className={`[&>div]:${useOptionBgColor(option.id)}`}
								id={`progress-${option.id}`}
							/>
						</Field>
					))}
				</div>

				{prediction.status === "draft" && (
					<span className={`text-sm text-muted-foreground text-right mt-4 block`}>
						Place your bets now!
					</span>
				)}
			</Link>
		</div>
	);
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ predictions }: { predictions: Prediction[] }) {
	const hasActive = predictions.some(
		(p) => p.status === "draft" || p.status === "locked",
	);
	const allLocked =
		hasActive && predictions.every((p) => p.status === "locked");

	if (hasActive) {
		if (allLocked) {
			return (
				<h2 className={`my-4 flex items-center gap-2 text-lg font-semibold`}>
					<PingLoading className={`inline-block`} />
					Live
				</h2>
			);
		}
		// Mixed or all draft: find the earliest deadline for the countdown
		const earliest = predictions
			.filter((p) => p.status === "draft")
			.sort(
				(a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
			)[0];
		return (
			<div className={`flex items-center gap-2 my-4`}>
				<h2 className={`text-lg font-semibold`}>In Play</h2>
				{earliest?.deadline && (
					<Countdown targetTime={new Date(earliest.deadline).getTime()} />
				)}
			</div>
		);
	}

	// Fallback: completed prediction
	const fallback = predictions[0];
	if (!fallback) return null;

	if (fallback.status === "revealed") {
		return (
			<h2 className={`my-4 flex items-center gap-2 text-lg font-semibold`}>
				<DotIcon className={`inline-block text-green-500 animate-pulse`} />
				Resolved
			</h2>
		);
	}
	if (fallback.status === "cancelled") {
		return (
			<h2 className={`my-4 flex items-center gap-2 text-lg font-semibold text-muted-foreground`}>
				<DotIcon className={`inline-block text-muted-foreground animate-pulse`} />
				Cancelled
			</h2>
		);
	}
	return (
		<h2 className={`my-4 flex items-center gap-2 text-lg font-semibold text-muted-foreground`}>
			<DotIcon className={`inline-block text-muted-foreground animate-pulse`} />
			No Result
		</h2>
	);
}

// ── Main component ─────────────────────────────────────────────────────────
function InPlayPredictions() {
	const { room } = useRoomContext();
	const { data: predictions = [], isPending: isPredictionLoading } =
		useActivePredictions(room.id);

	const multipleCards = predictions.length > 1;

	return (
		<div className={`max-w-lg mx-auto`}>
			{isPredictionLoading && (
				<div className={`flex flex-col gap-4 my-4`}>
					<Skeleton className={`h-8 w-35`} />
				</div>
			)}

			{!isPredictionLoading && predictions.length > 0 && (
				<SectionHeader predictions={predictions} />
			)}

			{/* Carousel — works gracefully with a single card too */}
			<Carousel
				opts={{ align: "start", loop: false }}
				className={`w-full ${multipleCards ? "px-10" : ""}`}
			>
				<CarouselContent>
					{isPredictionLoading ? (
						<CarouselItem>
							<div
								className={`border-2 border-cyan-900 rounded-xl p-4 flex flex-col gap-2 bg-secondary text-accent-foreground w-full`}
							>
								<Skeleton className={`h-6 mx-auto w-full`} />
								<Skeleton className={`h-10 mx-auto w-full`} />
								<Skeleton className={`h-10 mx-auto w-full`} />
							</div>
						</CarouselItem>
					) : predictions.length === 0 ? (
						<CarouselItem>
							<div
								className={`border-2 border-cyan-900 rounded-xl p-4 flex flex-col gap-2 bg-secondary text-accent-foreground w-full`}
							>
								<p className={`text-muted-foreground text-center py-4`}>
									No predictions yet. The host will start one soon!
								</p>
							</div>
						</CarouselItem>
					) : (
						predictions.map((prediction) => (
							<CarouselItem key={prediction.id}>
								<PredictionCard prediction={prediction} roomId={room.id} />
							</CarouselItem>
						))
					)}
				</CarouselContent>

				{/* Only show arrows when there are multiple predictions */}
				{multipleCards && (
					<>
						<CarouselPrevious />
						<CarouselNext />
					</>
				)}
			</Carousel>
		</div>
	);
}

export default InPlayPredictions;

