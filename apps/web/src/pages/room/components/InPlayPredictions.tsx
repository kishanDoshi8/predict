import { useActivePredictions } from "@/store/prediction";
import { useRoomContext } from "../RoomLayout";
import {
	Badge,
	Field,
	FieldLabel,
	Progress,
	Skeleton,
	PingLoading,
	Button,
} from "@/components";
import {
	Carousel,
	CarouselApi,
	CarouselContent,
	CarouselItem,
} from "@/components/ui/carousel";
import { Countdown } from "../widgets/CountDown";
import { useBets } from "@/store/bet";
import { useOptionBgColor } from "@/hooks/useOptionColor";
import {
	ArrowBigRight,
	ArrowRightIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	DotIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Prediction } from "@/types";
import React from "react";

// Threshold (as a percentage) above which an option is labelled "🔥 hot pick"
const HOT_PICK_THRESHOLD_PERCENT = 60;

// ── Per-card component ─────────────────────────────────────────────────────
// Fetches its own bets so each card in the carousel is self-contained.
function PredictionCard({
	prediction,
	roomId,
}: Readonly<{ prediction: Prediction; roomId: string }>) {
	const { data: bets = [] } = useBets(roomId, prediction.id);

	const betAmountPerOption: Record<string, number> = {};
	for (const bet of bets) {
		betAmountPerOption[bet.option_id] =
			(betAmountPerOption[bet.option_id] ?? 0) + bet.amount;
	}
	const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);

	const isActive =
		prediction.status === "draft" || prediction.status === "locked";

	let borderClass = "border-border";
	if (prediction.status === "locked") {
		borderClass = "border-primary/70";
	} else if (isActive) {
		borderClass = "border-cyan-900";
	}

	return (
		<div
			className={`border-2 rounded-xl p-4 flex flex-col gap-2 bg-secondary text-accent-foreground w-full transition-colors ${borderClass}`}
		>
			<Link
				to={`predictions/${prediction.id}`}
				className={`no-underline`}
			>
				{/* Status badge per card */}
				<div className={`flex items-center gap-2 mb-2`}>
					{prediction.status === "draft" && (
						<>
							<Badge
								variant='outline'
								className={`border-cyan-500 text-cyan-500 text-xs`}
							>
								In Play
							</Badge>
							{prediction.deadline && (
								<Countdown
									targetTime={new Date(
										prediction.deadline,
									).getTime()}
								/>
							)}
						</>
					)}
					{prediction.status === "locked" && (
						<div className={`flex items-center gap-2`}>
							<Badge
								variant='outline'
								className={`border-primary text-primary text-xs flex items-center gap-1`}
							>
								Live
							</Badge>
							<PingLoading
								className={`inline-block`}
								size={20}
								speed={2}
							/>
						</div>
					)}
					{prediction.status === "revealed" && (
						<Badge
							variant='outline'
							className={`text-green-500 text-xs flex items-center gap-1`}
						>
							<DotIcon className={`text-green-500`} />
							Resolved
						</Badge>
					)}
					{prediction.status === "cancelled" && (
						<Badge
							variant='outline'
							className={`text-muted-foreground text-xs flex items-center gap-1`}
						>
							<DotIcon className={`text-muted-foreground`} />
							Cancelled
						</Badge>
					)}
					{prediction.status === "no_result" && (
						<Badge
							variant='outline'
							className={`text-muted-foreground text-xs flex items-center gap-1`}
						>
							<DotIcon className={`text-muted-foreground`} />
							No Result
						</Badge>
					)}
				</div>

				<h4 className={`text-xl md:text-2xl mt-4`}>
					{prediction.title}
				</h4>

				<div className={`flex flex-col gap-4 mt-2`}>
					{prediction.prediction_options.map((option) => (
						<Field className='w-full' key={option.id}>
							<FieldLabel htmlFor={`progress-${option.id}`}>
								<span>
									{option.label}
									{/* hot pick label when one option captures HOT_PICK_THRESHOLD_PERCENT% or more of bets */}
									{totalBetAmount > 0 &&
									(betAmountPerOption[option.id] /
										totalBetAmount) *
										100 >=
										HOT_PICK_THRESHOLD_PERCENT ? (
										<Badge
											variant='outline'
											className='ml-2 text-xs'
										>
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
										? (betAmountPerOption[option.id] /
												totalBetAmount) *
											100
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
					<span
						className={`text-sm text-muted-foreground text-right mt-4 block`}
					>
						Place your bets now!
					</span>
				)}
				{prediction.status === "locked" && (
					<span
						className={`text-sm text-muted-foreground text-right mt-4 block`}
					>
						Waiting for result...
					</span>
				)}
			</Link>
		</div>
	);
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({
	predictions,
}: Readonly<{ predictions: Prediction[] }>) {
	const hasActive = predictions.some(
		(p) => p.status === "draft" || p.status === "locked",
	);
	const allLocked =
		hasActive && predictions.every((p) => p.status === "locked");

	if (hasActive) {
		if (allLocked) {
			return (
				<h2
					className={`my-4 flex items-center gap-2 text-lg font-semibold`}
				>
					Live
				</h2>
			);
		}

		return (
			<div className={`flex items-center gap-2 my-4`}>
				<h2 className={`text-lg font-semibold`}>Upcoming</h2>
			</div>
		);
	}

	// Fallback: completed prediction
	const fallback = predictions[0];
	if (!fallback) return null;

	if (fallback.status === "revealed") {
		return (
			<h2
				className={`my-4 flex items-center gap-2 text-lg font-semibold`}
			>
				<DotIcon
					className={`inline-block text-green-500 animate-pulse`}
				/>
				Resolved
			</h2>
		);
	}
	if (fallback.status === "cancelled") {
		return (
			<h2
				className={`my-4 flex items-center gap-2 text-lg font-semibold text-muted-foreground`}
			>
				<DotIcon
					className={`inline-block text-muted-foreground animate-pulse`}
				/>
				Cancelled
			</h2>
		);
	}
	return (
		<h2
			className={`my-4 flex items-center gap-2 text-lg font-semibold text-muted-foreground`}
		>
			<DotIcon
				className={`inline-block text-muted-foreground animate-pulse`}
			/>
			No Result
		</h2>
	);
}

// ── Main component ─────────────────────────────────────────────────────────
function InPlayPredictions() {
	const { room } = useRoomContext();
	const { data: predictions = [], isPending: isPredictionLoading } =
		useActivePredictions(room.id);

	const [api, setApi] = React.useState<CarouselApi>();
	const [current, setCurrent] = React.useState(0);

	React.useEffect(() => {
		if (!api) return;
		setCurrent(api.selectedScrollSnap());

		api.on("select", () => {
			setCurrent(api.selectedScrollSnap());
		});
	}, [api]);

	React.useEffect(() => {
		if (!api) return;
		api.scrollTo(0);
	}, [api]);

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

			<Carousel
				opts={{ align: "start" }}
				className={`w-full`}
				setApi={setApi}
			>
				<CarouselContent>
					{isPredictionLoading ? (
						<CarouselItem>
							<div
								className={`border-2 border-cyan-900 rounded-xl p-4 flex flex-col gap-2 bg-secondary text-accent-foreground w-full space-y-2`}
							>
								<Skeleton className={`h-5 w-22`} />
								<Skeleton className={`h-7 mx-auto w-full`} />
								<Skeleton className={`h-9 mx-auto w-full`} />
								<Skeleton className={`h-9 mx-auto w-full`} />
								<Skeleton className={`h-6 ml-auto w-34`} />
							</div>
						</CarouselItem>
					) : predictions.length === 0 ? (
						<CarouselItem>
							<div
								className={`border-2 border-cyan-900 rounded-xl p-4 flex flex-col gap-2 bg-secondary text-accent-foreground w-full`}
							>
								<p
									className={`text-muted-foreground text-center py-4`}
								>
									No predictions yet. The host will start one
									soon!
								</p>
							</div>
						</CarouselItem>
					) : (
						predictions.map((prediction) => (
							<CarouselItem key={prediction.id}>
								<PredictionCard
									prediction={prediction}
									roomId={room.id}
								/>
							</CarouselItem>
						))
					)}
				</CarouselContent>
			</Carousel>

			<div className={`flex justify-between items-center mt-4 px-2`}>
				{predictions.length > 1 && (
					<button
						onClick={() => api?.scrollPrev()}
						aria-label='Previous'
					>
						<ChevronLeftIcon className={`text-foreground/75`} />
					</button>
				)}

				{/* Dot indicators */}
				<div className='flex justify-center gap-2 mt-2 mx-auto'>
					{Array.from({ length: predictions.length }).map(
						(_, index) => (
							<button
								key={index}
								onClick={() => api?.scrollTo(index)}
								className={`h-2 rounded-full transition-all duration-300 ${
									index === current
										? "w-6 bg-primary"
										: "w-2 bg-muted-foreground/80"
								}`}
								aria-label={`Go to slide ${index + 1}`}
							/>
						),
					)}
				</div>

				{predictions.length > 1 && (
					<button onClick={() => api?.scrollNext()} aria-label='Next'>
						<ChevronRightIcon className={`text-foreground/75`} />
					</button>
				)}
			</div>
		</div>
	);
}

export default InPlayPredictions;
