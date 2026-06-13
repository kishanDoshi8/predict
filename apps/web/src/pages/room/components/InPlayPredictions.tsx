import { useActivePredictions } from "@/store/prediction";
import { motion } from "framer-motion";
import { useRoomContext } from "../RoomLayout";
import {
	Badge,
	CountUp,
	FadeContent,
	Field,
	FieldLabel,
	Progress,
	Skeleton,
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
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	Clock,
	CrownIcon,
	DotIcon,
	TrophyIcon,
	UsersIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Prediction } from "@/types";
import React from "react";
import { usePlayer } from "@/store/player";

// Threshold (as a percentage) above which an option is labelled "🔥 hot pick"
const HOT_PICK_THRESHOLD_PERCENT = 60;
const contentDelays = {
	title: 0,
	options: 200,
	pooled: 400,
	participants: 400,
	timer: 600,
};

// ── Per-card component ─────────────────────────────────────────────────────
// Fetches its own bets so each card in the carousel is self-contained.
function PredictionCard({
	prediction,
	roomId,
}: Readonly<{ prediction: Prediction; roomId: string }>) {
	const { data: bets = [] } = useBets(roomId, prediction.id);
	const { data: player } = usePlayer();

	const betAmountPerOption: Record<string, number> = {};
	for (const bet of bets) {
		betAmountPerOption[bet.option_id] =
			(betAmountPerOption[bet.option_id] ?? 0) + bet.amount;
	}
	const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);
	const myBet = bets.find((b) => b.player_id === player?.id);

	const isActive =
		prediction.status === "draft" || prediction.status === "locked";

	let borderClass = "border-border";
	if (prediction.status === "locked") {
		borderClass = "border-primary/50";
	} else if (isActive) {
		borderClass = "border-accent";
	}

	return (
		<motion.div
			animate={{ height: "auto", opacity: 1 }}
			transition={{ type: "spring", duration: 0.4 }}
			className={`text-card-foreground flex flex-col gap-6 rounded-xl border shadow-sm relative overflow-hidden border-border bg-linear-to-br from-card to-primary/5 p-5 mb-4 ${borderClass}`}
		>
			<div
				className={`absolute inset-0 bg-linear-to-r from-primary/5 via-primary/15 to-primary/5 animate-pulse pointer-events-none`}
			></div>
			<Link to={`predictions/${prediction.id}`}>
				{/* Status badge per card */}
				<div className={`flex items-center gap-2 mb-3`}>
					{prediction.status === "draft" && (
						<>
							<Badge
								variant='secondary'
								className={`text-muted-foreground font-bold text-xs flex items-center gap-1 mr-auto`}
							>
								<Clock />
								COMING UP
							</Badge>
							{prediction.deadline && (
								<FadeContent delay={contentDelays.timer}>
									<Countdown
										targetTime={new Date(
											prediction.deadline,
										).getTime()}
									/>
								</FadeContent>
							)}
						</>
					)}
					{prediction.status === "locked" && (
						<div className='flex items-center gap-2 mr-auto'>
							<Badge
								className={`bg-primary/20 text-primary text-xs flex items-center gap-1`}
							>
								<span
									className={`h-2 w-2 rounded-full bg-primary animate-pulse`}
								/>{" "}
								LIVE
							</Badge>
						</div>
					)}
					{prediction.status === "revealed" && (
						<div className={`flex items-center gap-2`}>
							<Badge
								variant='outline'
								className={`text-green-500 text-xs flex items-center gap-1`}
							>
								<CheckIcon className={`w-3 h-3`} />
								Resolved
							</Badge>
						</div>
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

				<FadeContent delay={contentDelays.title}>
					<h4 className={`text-xl md:text-2xl font-semibold mb-4`}>
						{prediction.title}
					</h4>
				</FadeContent>

				<FadeContent
					delay={contentDelays.options}
					className={`flex flex-col gap-4 mt-2`}
				>
					{prediction.prediction_options.map((option) => (
						<Field className='w-full' key={option.id}>
							<FieldLabel htmlFor={`progress-${option.id}`}>
								<span className={`flex items-center`}>
									{option.label}
									{prediction.winning_option_id ===
										option.id && (
										<Badge
											variant='outline'
											className=' text-sm flex items-center gap-1 text-win ml-2'
										>
											<CrownIcon
												className={`w-4! h-4!`}
											/>
										</Badge>
									)}
									{/* hot pick label when one option captures HOT_PICK_THRESHOLD_PERCENT% or more of bets */}
									{totalBetAmount > 0 &&
									(betAmountPerOption[option.id] /
										totalBetAmount) *
										100 >=
										HOT_PICK_THRESHOLD_PERCENT ? (
										<Badge
											variant='outline'
											className='ml-1 text-xs'
										>
											🔥 hot pick
										</Badge>
									) : null}
								</span>
								<span className={`ml-auto`}>
									{(
										betAmountPerOption[option.id] ?? 0
									).toLocaleString()}{" "}
									pts
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
								className={`[&>div]:${useOptionBgColor(option.id)}`}
								id={`progress-${option.id}`}
							/>
						</Field>
					))}
				</FadeContent>

				<div className={`flex items-center justify-between mt-4`}>
					{/* show total pooled */}
					<FadeContent
						delay={contentDelays.pooled}
						className={`flex items-center gap-2`}
					>
						<TrophyIcon
							className={`text-muted-foreground w-3 h-3`}
						/>
						<p className={`text-sm text-muted-foreground`}>
							Pooled:{" "}
							<CountUp
								className={`text-foreground font-semibold`}
								to={totalBetAmount}
								separator=','
							/>{" "}
							pts
						</p>
					</FadeContent>
					{/* total participants */}
					<FadeContent
						delay={contentDelays.participants}
						className={`flex items-center gap-2`}
					>
						<UsersIcon
							className={`text-muted-foreground w-3 h-3`}
						/>
						<span
							className={`text-foreground text-sm font-semibold`}
						>
							{bets.length.toLocaleString()}
						</span>
					</FadeContent>
				</div>

				{myBet &&
					prediction.status === "revealed" &&
					(() => {
						const pickedOption = prediction.prediction_options.find(
							(opt) => opt.id === myBet.option_id,
						)?.label;
						const isWin =
							myBet.option_id === prediction.winning_option_id;

						return (
							<span
								className={`flex items-center justify-end text-sm mt-6 text-muted-foreground`}
							>
								{isWin
									? "🎉 Nailed it with:"
									: "😵 Plot twist, you picked:"}{" "}
								<span
									className={`font-semibold ml-1 ${isWin ? "text-win" : "text-loss"}`}
								>
									{pickedOption}
								</span>
							</span>
						);
					})()}

				{prediction.status === "draft" && (
					<span
						className={`flex items-center justify-end text-sm text-foreground text-right mt-6`}
					>
						{myBet
							? `${myBet.amount.toLocaleString()} pts riding on ${prediction.prediction_options.find((opt) => opt.id === myBet.option_id)?.label}`
							: "Place your bet now!"}
						<ChevronRightIcon className={`inline-block ml-1`} />
					</span>
				)}
				{prediction.status === "locked" && (
					<span
						className={`text-sm text-muted-foreground text-right mt-6 block`}
					>
						{myBet
							? "Locked in — fingers crossed!"
							: "Market closed. Watching live..."}
					</span>
				)}
			</Link>
		</motion.div>
	);
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({
	predictions,
}: Readonly<{ predictions: Prediction[] }>) {
	const hasActive = predictions.some(
		(p) => p.status === "draft" || p.status === "locked",
	);

	if (hasActive) {
		return (
			<div className={`flex items-center gap-2 my-4`}>
				<div className={`flex flex-1 items-center gap-2`}>
					<span
						className={`h-2 w-2 rounded-full bg-primary animate-pulse`}
					/>
					<h2 className={`text-lg font-semibold`}>What's Hot</h2>
				</div>
				<div className={`text-xs text-muted-foreground`}>
					{predictions.length}
					{" active"}
				</div>
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
				Last Played
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

		const storageKey = `room-${room.id}-predictions-carousel-index`;
		const maxIndex = Math.max(predictions.length - 1, 0);

		let initialIndex = 0;

		try {
			const raw = localStorage.getItem(storageKey);
			const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);

			if (Number.isInteger(parsed)) {
				// Clamp to valid range [0, maxIndex]
				initialIndex = Math.min(Math.max(parsed, 0), maxIndex);
			}
		} catch {
			initialIndex = 0;
		}

		api.scrollTo(initialIndex);
		setCurrent(initialIndex);

		const onSelect = () => {
			const selected = api.selectedScrollSnap();
			setCurrent(selected);
			try {
				localStorage.setItem(storageKey, String(selected));
			} catch {
				// ignore storage errors
			}
		};

		api.on("select", onSelect);

		return () => {
			api.off("select", onSelect);
		};
	}, [api, room.id, predictions.length]);

	let carouselContent;
	if (isPredictionLoading) {
		carouselContent = (
			<CarouselItem>
				<div
					className={`border-2 border-cyan-900 rounded-xl p-4 flex flex-col gap-2 bg-secondary text-accent-foreground w-full space-y-2`}
				>
					<Skeleton className={`h-5 w-22`} />
					<Skeleton className={`h-7 mx-auto w-full`} />
					<Skeleton className={`h-11 mx-auto w-full`} />
					<Skeleton className={`h-11 mx-auto w-full`} />
					<span className={`flex justify-between items-center`}>
						<Skeleton className={`h-6 w-34`} />
						<Skeleton className={`h-6 w-20`} />
					</span>
					<Skeleton className={`h-6 ml-auto w-34`} />
				</div>
			</CarouselItem>
		);
	} else if (predictions.length === 0) {
		carouselContent = (
			<CarouselItem>
				<div
					className={`border-2 border-cyan-900 rounded-xl p-4 flex flex-col gap-2 bg-secondary text-accent-foreground w-full`}
				>
					<p className={`text-muted-foreground text-center py-4`}>
						No predictions yet. The host will start one soon!
					</p>
				</div>
			</CarouselItem>
		);
	} else {
		carouselContent = predictions.map((prediction) => (
			<CarouselItem key={prediction.id}>
				<PredictionCard prediction={prediction} roomId={room.id} />
			</CarouselItem>
		));
	}

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
				<CarouselContent>{carouselContent}</CarouselContent>
			</Carousel>

			<div className={`flex justify-between items-center  px-2`}>
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
