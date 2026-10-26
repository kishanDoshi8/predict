import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Badge,
	Skeleton,
	DrawerTitle,
	DrawerHeader,
	DrawerContent,
	Drawer,
	DrawerDescription,
	Field,
	FieldLabel,
	Progress,
	FadeContent,
} from "@/shared/ui";
import {
	useRoomMemberRecentPredictions,
	useRoomMemberSeriesRecognition,
	useRoomMemberStats,
} from "@/features/leaderboard";
import { getSeriesAwardLabel } from "@/shared/lib/seriesRewards";
import {
	getAwardVisual,
	getChampionshipVisual,
} from "@/shared/lib/seriesRecognitionVisuals";
import { cn } from "@/shared/lib/utils";
import {
	ChartColumnIcon,
	CheckIcon,
	CircleDollarSign,
	CircleSlash,
	CoinsIcon,
	Crosshair,
	FlameIcon,
	MedalIcon,
	TargetIcon,
	TrophyIcon,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { FEATURES } from "@/shared/constants/features";

const statsLabels = [
	{
		key: "current_points",
		label: "Lifetime Winnings",
		icon: <CoinsIcon className={`text-rank-1`} size={20} />,
	},
	// Ratings are hidden while the series standings are the one ranking.
	// {
	// 	key: "current_rating",
	// 	label: "Current Rating",
	// 	icon: <ZapIcon className={`text-cyan-500`} size={20} />, (re-import ZapIcon)
	// },
	{
		key: "total_predictions",
		label: "Predictions Made",
		icon: <TargetIcon className={`text-primary`} size={20} />,
	},
	// { key: "peak_rating", label: "Peak Rating" },
	// { key: "winning_predictions", label: "Winning Predictions" },
	// { key: "total_rated_predictions", label: "Rated Predictions" },
	{
		key: "current_win_streak",
		label: "Current Win Streak",
		icon: <FlameIcon className={`text-rank-3`} size={20} />,
	},
	// { key: "highest_win_streak", label: "Highest Win Streak" },
	// {
	// 	key: "activity_streak",
	// 	label: "Activity Streak",
	// 	icon: <CalendarClockIcon className={`text-accent`} size={20} />,
	// },
] as const;

type Props = {
	roomId: string;
	playerId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const resultBadgeMeta = {
	won: {
		id: "won",
		className: "bg-win/20 text-win",
		icon: <CheckIcon className={`w-4 h-4 text-win`} />,
	},
	lost: {
		id: "lost",
		className: "bg-loss/20 text-loss",
		icon: <X className={`w-4 h-4 text-loss`} />,
	},
	no_result: {
		id: "no_result",
		className: "bg-muted text-muted-foreground",
		icon: <CircleSlash className={`w-4 h-4 text-muted-foreground`} />,
	},
} as const;

const STAT_TILE = "rounded-lg p-3 bg-card border border-border/60 flex flex-col gap-2";

// Same tiles as the stats: one per stat, then Largest win and Win rate.
function StatsSkeleton() {
	return (
		<div className='grid grid-cols-2 gap-4' aria-hidden='true'>
			{statsLabels.map(({ key }) => (
				<div key={key} className={STAT_TILE}>
					<Skeleton className='h-3 w-20' />
					<Skeleton className='h-8 w-16' />
				</div>
			))}
			<div className={cn(STAT_TILE, "col-span-2")}>
				<Skeleton className='h-3 w-20' />
				<Skeleton className='h-8 w-32' />
				<Skeleton className='h-3 w-40' />
			</div>
			<div className={cn(STAT_TILE, "col-span-2")}>
				<Skeleton className='h-3 w-16' />
				<div className='flex items-end justify-between'>
					<Skeleton className='h-8 w-20' />
					<Skeleton className='h-4 w-12' />
				</div>
				<Skeleton className='h-2 w-full' />
			</div>
		</div>
	);
}

// The last five results as a row of round badges.
function RecentPredictionsSkeleton() {
	return (
		<div className='flex gap-2' aria-hidden='true'>
			{Array.from({ length: 5 }).map((_, i) => (
				<Skeleton key={i} className='size-8 rounded-full' />
			))}
		</div>
	);
}

// Championship or award rows: icon tile, a small label, the series name.
function RecognitionRowsSkeleton({ iconSize }: Readonly<{ iconSize: "size-12" | "size-10" }>) {
	return (
		<div className='space-y-2' aria-hidden='true'>
			{[0, 1].map((i) => (
				<div
					key={i}
					className='flex items-center gap-3 rounded-2xl border bg-card p-3.5'
				>
					<Skeleton className={cn("shrink-0 rounded-xl", iconSize)} />
					<div className='flex flex-1 flex-col gap-1.5'>
						<Skeleton className='h-3 w-20' />
						<Skeleton className='h-4 w-36' />
					</div>
				</div>
			))}
		</div>
	);
}

// function formatCollectedDate(value: string | null) {
// 	if (!value) {
// 		return "Not yet collected";
// 	}

// 	return `Collected ${new Date(value).toLocaleDateString(undefined, {
// 		year: "numeric",
// 		month: "short",
// 		day: "numeric",
// 	})}`;
// }

export function PlayerProfileDialog({
	roomId,
	playerId,
	open,
	onOpenChange,
}: Readonly<Props>) {
	const enabled = open && !!playerId;
	const {
		data: stats,
		isPending: isStatsLoading,
		error: statsError,
	} = useRoomMemberStats(roomId, playerId, enabled);
	const {
		data: recentPredictions = [],
		isPending: isHistoryLoading,
		error: historyError,
	} = useRoomMemberRecentPredictions(roomId, playerId, 5, 0, enabled);
	const {
		data: seriesRecognition,
		isPending: isSeriesRecognitionLoading,
		error: seriesRecognitionError,
	} = useRoomMemberSeriesRecognition(roomId, playerId, enabled);
	// Duel awards stay hidden while duels are switched off, as in the Hall of Fame.
	const visibleAwards = (seriesRecognition?.awards ?? []).filter(
		(award) => FEATURES.duels || award.award_type !== "MOST_DUEL_WINS",
	);

	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (statsError) {
			setError(
				statsError.message ||
					"An error occurred while loading the player stats.",
			);
		} else if (historyError) {
			setError(
				historyError.message ||
					"An error occurred while loading the player history.",
			);
		} else if (seriesRecognitionError) {
			setError(
				seriesRecognitionError.message ||
					"An error occurred while loading player recognitions.",
			);
		} else {
			setError(null);
		}
	}, [historyError, seriesRecognitionError, statsError]);

	const recentPredictionsContent = (() => {
		if (isHistoryLoading) {
			return <RecentPredictionsSkeleton />;
		}

		if (recentPredictions.length === 0) {
			return (
				<div className='rounded-lg border border-border/60 p-4 text-sm text-muted-foreground'>
					No resolved predictions yet.
				</div>
			);
		}

		return (
			<div className='flex gap-2'>
				{recentPredictions.map((entry, i) => {
					const resultMeta = resultBadgeMeta[entry.result];
					return (
						<Badge
							key={entry.prediction_id}
							className={`rounded-full p-2 border ${resultMeta.className} ${i === 0 ? "ring" : ""}`}
						>
							<div className={`flex flex-col items-center`}>
								{resultMeta.icon}
							</div>
						</Badge>
					);
				})}
			</div>
		);
	})();

	const championshipsContent = (() => {
		if (isSeriesRecognitionLoading) {
			return <RecognitionRowsSkeleton iconSize='size-12' />;
		}

		if (seriesRecognition?.championships.length) {
			return (
				<div className='space-y-2'>
					{seriesRecognition.championships.map((row) => {
						const tierVisual = getChampionshipVisual(row.placement);
						return (
							<div
								key={row.id}
								className={cn(
									"flex items-center gap-3 rounded-2xl border bg-card p-3.5",
									tierVisual.ringClassName,
								)}
							>
								<div
									className={cn(
										"flex size-12 shrink-0 items-center justify-center rounded-xl border",
										tierVisual.ringClassName,
									)}
								>
									<tierVisual.Icon
										className={cn(
											"size-6",
											tierVisual.textClassName,
										)}
									/>
								</div>

								<div className='min-w-0 flex-1'>
									<p
										className={cn(
											"text-[11px] font-semibold uppercase tracking-wider",
											tierVisual.textClassName,
										)}
									>
										{tierVisual.tierLabel}
									</p>
									<p className='truncate text-sm font-semibold text-foreground'>
										{row.series_title}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			);
		}

		return (
			<div className='rounded-lg border border-border/60 p-4 text-sm text-muted-foreground'>
				No championships yet.
			</div>
		);
	})();

	const awardsContent = (() => {
		if (isSeriesRecognitionLoading) {
			return <RecognitionRowsSkeleton iconSize='size-10' />;
		}

		if (visibleAwards.length) {
			return (
				<div className='space-y-2'>
					{visibleAwards.map((row) => {
						const awardVisual = getAwardVisual(row.award_type);

						return (
							<div
								key={row.id}
								className='flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5'
							>
								<div
									className={cn(
										"flex size-10 shrink-0 items-center justify-center rounded-xl border",
										awardVisual.ringClassName,
									)}
								>
									<awardVisual.Icon
										className={cn(
											"size-5",
											awardVisual.textClassName,
										)}
									/>
								</div>

								<div className='min-w-0 flex-1'>
									<p className='truncate text-sm font-semibold text-foreground'>
										{getSeriesAwardLabel(row.award_type)}
									</p>
									<p className='truncate text-[11px] text-muted-foreground'>
										{row.series_title}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			);
		}

		return (
			<div className='rounded-lg border border-border/60 p-4 text-sm text-muted-foreground'>
				No awards yet.
			</div>
		);
	})();

	const isDesktop = window.innerWidth >= 768; // Example breakpoint for desktop
	const MainComponent = isDesktop ? Dialog : Drawer;
	const ContentComponent = isDesktop ? DialogContent : DrawerContent;
	const HeaderComponent = isDesktop ? DialogHeader : DrawerHeader;
	const TitleComponent = isDesktop ? DialogTitle : DrawerTitle;
	const DescriptionComponent = isDesktop
		? DialogDescription
		: DrawerDescription;

	return (
		<MainComponent open={open} onOpenChange={onOpenChange}>
			<ContentComponent className='sm:max-w-3xl max-h-[85vh]'>
				<HeaderComponent className={`px-4`}>
					<TitleComponent
						className={`flex items-center gap-2 text-2xl`}
					>
						{isStatsLoading ? (
							<Skeleton className='h-7 w-36' />
						) : (
							(stats?.username ?? "Player profile")
						)}
					</TitleComponent>
					<DescriptionComponent className={`flex gap-2`}>
						{isStatsLoading ? (
							<Skeleton className='h-5 w-10 rounded-full' />
						) : null}
						{stats?.highest_win_streak !== undefined &&
							stats.highest_win_streak !== 0 && (
								<div className={`inline-block`}>
									<Badge
										className={`flex gap-0 items-center justify-center bg-accent/20 text-accent text-xs`}
									>
										<FlameIcon
											className={`w-2 h-2 text-rank-3`}
										/>
										{stats.highest_win_streak}
									</Badge>
								</div>
							)}
					</DescriptionComponent>
				</HeaderComponent>

				{error && (
					<div className='p-4 text-sm text-destructive'>{error}</div>
				)}

				<div className={`p-4 overflow-auto no-scrollbar`}>
					<section className='space-y-3'>
						<div className='grid grid-cols-2 gap-3'>
							<div className='rounded-lg border border-border/60 bg-card p-3'>
								<p className='text-xs text-muted-foreground'>
									Championships
								</p>
								<p className='mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums'>
									<TrophyIcon className='h-5 w-5 text-rank-1' />
									{isSeriesRecognitionLoading ? (
										<Skeleton className='h-6 w-8' />
									) : (
										(seriesRecognition?.championships.length ?? 0)
									)}
								</p>
							</div>
							<div className='rounded-lg border border-border/60 bg-card p-3'>
								<p className='text-xs text-muted-foreground'>
									Awards
								</p>
								<p className='mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums'>
									<MedalIcon className='h-5 w-5 text-accent' />
									{isSeriesRecognitionLoading ? (
										<Skeleton className='h-6 w-8' />
									) : (
										(visibleAwards.length ?? 0)
									)}
								</p>
							</div>
						</div>

						<div className='space-y-2 mt-6'>
							<h3 className='flex items-center gap-2 text-sm font-semibold text-muted-foreground'>
								<TrophyIcon className='h-4 w-4 text-rank-1' />
								Championships
							</h3>
							{championshipsContent}
						</div>

						<div className='space-y-2 pb-2 mt-6'>
							<h3 className='flex items-center gap-2 text-sm font-semibold text-muted-foreground'>
								<MedalIcon className='h-4 w-4 text-accent' />
								Awards
							</h3>
							{awardsContent}
						</div>
					</section>

					<section className='space-y-2 mt-4'>
						<h3 className='flex items-center gap-2 text-sm font-semibold text-muted-foreground'>
							<ChartColumnIcon className='h-4 w-4 text-activity' />
							Stats
						</h3>
						{isStatsLoading ? (
							<StatsSkeleton />
						) : !stats ? null : (
							<div className='grid grid-cols-2 gap-4'>
								{statsLabels.map(({ key, label, icon }) => (
									<FadeContent
										key={key}
										delay={50}
										className='rounded-lg p-3 bg-card border border-border/60 flex flex-col gap-2'
									>
										<p className='flex justify-between text-xs text-muted-foreground'>
											{label}
										</p>
										<p className='font-semibold tabular-nums flex items-center gap-2'>
											{icon}
											<span className={`text-2xl`}>
												{key === "current_points"
													? stats[
															key
														]?.toLocaleString()
													: stats[key]}
											</span>
										</p>
									</FadeContent>
								))}
								<FadeContent
									delay={100}
									className='col-span-2 rounded-lg p-3 bg-card border border-border/60 flex flex-col gap-2'
								>
									<h3 className='flex gap-2 items-center text-xs text-muted-foreground'>
										<span>Largest Win</span>
									</h3>
									<div>
										<p
											className={`flex items-center gap-2 text-2xl font-semibold tabular-nums`}
										>
											<CircleDollarSign
												className={`text-rank-1`}
												size={20}
											/>
											<span>
												{(
													stats?.largest_win_payout ??
													0
												).toLocaleString()}{" "}
												pts
											</span>
										</p>
										<p className='text-xs text-muted-foreground'>
											Bet{" "}
											{(
												stats?.largest_win_bet ?? 0
											).toLocaleString()}{" "}
											•{" "}
											{(
												stats?.largest_win_multiplier ??
												0
											).toFixed(2)}
											x return
										</p>
									</div>
								</FadeContent>
								<FadeContent
									delay={100}
									className='col-span-2 rounded-lg p-3 bg-card border border-border/60 flex flex-col gap-2'
								>
									<h3 className='flex items-center gap-2 text-xs text-muted-foreground'>
										Win rate
									</h3>
									<Field className='w-full '>
										<FieldLabel
											htmlFor='progress-upload'
											className={`flex items-end`}
										>
											<span
												className={`flex items-center gap-2 text-2xl font-semibold tabular-nums`}
											>
												<Crosshair
													className='text-primary'
													size='20'
												/>
												{Math.round(
													((stats?.winning_predictions ??
														0) /
														(stats?.total_rated_predictions ??
															1)) *
														100,
												)}
												%
											</span>
											<span className='ml-auto'>
												{stats?.winning_predictions ??
													0}{" "}
												/{" "}
												{stats?.total_rated_predictions ??
													0}
											</span>
										</FieldLabel>
										<Progress
											value={
												((stats?.winning_predictions ??
													0) /
													(stats?.total_rated_predictions ??
														1)) *
												100
											}
											id='progress-upload'
										/>
									</Field>
								</FadeContent>
							</div>
						)}
					</section>

					<section className='mt-6 mb-4'>
						<FadeContent delay={100}>
							<h3 className='text-sm font-semibold text-muted-foreground mb-2'>
								Last 5 Predictions
							</h3>
							{recentPredictionsContent}
						</FadeContent>
					</section>
				</div>
			</ContentComponent>
		</MainComponent>
	);
}
