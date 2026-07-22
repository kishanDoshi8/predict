import { SeriesEditDialog } from "@/features/series/components/SeriesEditDialog";
import { SeriesOverviewCard } from "@/features/series/components/SeriesOverviewCard";
import type {
	LeaderboardEntry,
	PredictionHistoryEntry,
} from "@/features/leaderboard";
import { PredictionHistoryFeed } from "@/features/leaderboard";
import { InPlayPredictions, UserStats } from "@/features/predictions";
import type { Prediction } from "@/features/predictions";
import type { Series } from "@/features/series/types/series";
import type { SeriesAward, SeriesPlacement } from "@/shared/lib/api";
import { getSeriesAwardLabel, getSeriesPlacementLabel } from "@/shared/lib/seriesRewards";
import { Badge, Button } from "@/shared/ui";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/ui/dialog";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	type CarouselApi,
} from "@/shared/ui/carousel";
import {
	CheckIcon,
	ChevronLeftIcon,
	CircleDollarSign,
	CoinsIcon,
	Crosshair,
	FlameIcon,
	RocketIcon,
	SparklesIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

type SeriesFormState = {
	title: string;
	description: string;
	expectedGames: string;
};

type SeriesDetailViewProps = {
	series: Series;
	isOrganizer: boolean;
	isActionPending: boolean;
	isUpdatePending: boolean;
	seriesOpenPredictions: Prediction[];
	seriesCompletedPredictions: PredictionHistoryEntry[];
	isCompletedPredictionsLoading: boolean;
	seriesLeaderboard: LeaderboardEntry[];
	isSeriesLeaderboardLoading: boolean;
	seriesPlacements: SeriesPlacement[];
	isSeriesPlacementsLoading: boolean;
	seriesAwards: SeriesAward[];
	isSeriesAwardsLoading: boolean;
	currentPlayerId: string | null;
	onCollectRewards: () => void;
	isCollectRewardsPending: boolean;
	isEditorOpen: boolean;
	formState: SeriesFormState;
	onBackToList: () => void;
	onEdit: () => void;
	onArchive: () => void;
	onCloseSeries: () => void;
	onNewPrediction: () => void;
	onEditDialogOpenChange: (open: boolean) => void;
	onFormStateChange: (nextState: SeriesFormState) => void;
	onCancelEdit: () => void;
	onSaveEdit: () => void;
};

export function SeriesDetailView({
	series,
	isOrganizer,
	isActionPending,
	isUpdatePending,
	seriesOpenPredictions,
	seriesCompletedPredictions,
	isCompletedPredictionsLoading,
	seriesLeaderboard,
	isSeriesLeaderboardLoading,
	seriesPlacements,
	isSeriesPlacementsLoading,
	seriesAwards,
	isSeriesAwardsLoading,
	currentPlayerId,
	onCollectRewards,
	isCollectRewardsPending,
	isEditorOpen,
	formState,
	onBackToList,
	onEdit,
	onArchive,
	onCloseSeries,
	onNewPrediction,
	onEditDialogOpenChange,
	onFormStateChange,
	onCancelEdit,
	onSaveEdit,
}: Readonly<SeriesDetailViewProps>) {
	const [compactBackButton, setCompactBackButton] = useState(false);
	const [isCollectDialogOpen, setIsCollectDialogOpen] = useState(false);
	const [collectCarouselApi, setCollectCarouselApi] = useState<CarouselApi>();
	const [collectCurrentSlide, setCollectCurrentSlide] = useState(0);
	const isSeriesClosed =
		series.status === "completed" || series.status === "archived";
	const champion = seriesPlacements.find((entry) => entry.placement === 1) ?? null;
	const podiumRunners = seriesPlacements.filter(
		(entry) => entry.placement === 2 || entry.placement === 3,
	);
	const uncollectedRewards = [
		...seriesPlacements
			.filter(
				(entry) =>
					entry.player_id === currentPlayerId && entry.collected_at === null,
			)
			.map((entry) => ({
				key: `placement-${entry.id}`,
				title: getSeriesPlacementLabel(entry.placement),
				subtitle: `${series.title}`,
				description: `+${Math.round(entry.points).toLocaleString()} points`,
			})),
		...seriesAwards
			.filter(
				(entry) =>
					entry.player_id === currentPlayerId && entry.collected_at === null,
			)
			.map((entry) => ({
				key: `award-${entry.id}`,
				title: getSeriesAwardLabel(entry.award_type),
				subtitle: entry.description,
				description: `+${Math.round(entry.value).toLocaleString()} value`,
			})),
	];

	useEffect(() => {
		const onScroll = () => {
			setCompactBackButton(window.scrollY > 80);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => {
		if (!collectCarouselApi) return;
		setCollectCurrentSlide(collectCarouselApi.selectedScrollSnap());
		collectCarouselApi.on("select", () => {
			setCollectCurrentSlide(collectCarouselApi.selectedScrollSnap());
		});
	}, [collectCarouselApi]);

	return (
		<div className='mx-auto w-full max-w-md space-y-6 p-4'>
			<SeriesOverviewCard
				series={series}
				isOrganizer={isOrganizer}
				isActionPending={isActionPending}
				onEdit={onEdit}
				onArchive={onArchive}
				onCloseSeries={onCloseSeries}
			/>

			{isSeriesClosed ? (
				<>
					<section className='space-y-3'>
						<h3 className='text-lg font-semibold'>Hall of Champions</h3>
						{isSeriesPlacementsLoading ? (
							<div className='rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground'>
								Loading champions…
							</div>
						) : champion ? (
							<>
								<div
									className={`rounded-xl border border-border/60 bg-card p-4 ${
										champion.collected_at ? "" : "opacity-60"
									}`}
								>
									<div className='flex items-center justify-between gap-3'>
										<div>
											<p className='text-xs text-muted-foreground'>
												Champion
											</p>
											<p className='text-xl font-semibold'>
												{champion.username}
											</p>
											<p className='text-sm text-muted-foreground'>
												{Math.round(
													champion.points,
												).toLocaleString()}{" "}
												points
											</p>
										</div>
										{champion.collected_at ? (
											<Badge className='gap-1 bg-muted text-foreground'>
												<CheckIcon className='h-3.5 w-3.5' />
												Collected
											</Badge>
										) : null}
									</div>
								</div>
								<div className='grid grid-cols-2 gap-3'>
									{podiumRunners.map((entry) => (
										<div
											key={entry.id}
											className={`rounded-xl border border-border/60 bg-card p-3 ${
												entry.collected_at ? "" : "opacity-60"
											}`}
										>
											<p className='text-xs text-muted-foreground'>
												{getSeriesPlacementLabel(
													entry.placement,
												)}
											</p>
											<p className='font-semibold'>
												{entry.username}
											</p>
											<p className='text-xs text-muted-foreground'>
												{Math.round(
													entry.points,
												).toLocaleString()}{" "}
												points
											</p>
											{entry.collected_at ? (
												<p className='mt-2 text-[11px] text-muted-foreground'>
													Collected
												</p>
											) : null}
										</div>
									))}
								</div>
							</>
						) : (
							<div className='rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground'>
								No placements available yet.
							</div>
						)}
					</section>

					<section className='space-y-3'>
						<h3 className='text-lg font-semibold'>Series Awards</h3>
						{isSeriesAwardsLoading ? (
							<div className='rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground'>
								Loading awards…
							</div>
						) : seriesAwards.length > 0 ? (
							<div className='space-y-2'>
								{seriesAwards.map((award) => (
									<div
										key={award.id}
										className={`rounded-xl border border-border/60 bg-card p-3 ${
											award.collected_at ? "" : "opacity-60"
										}`}
									>
										<div className='flex items-start justify-between gap-3'>
											<div className='space-y-1'>
												<p className='flex items-center gap-2 text-sm font-semibold'>
													{award.award_type ===
													"LONGEST_STREAK" ? (
														<FlameIcon className='h-4 w-4 text-rank-3' />
													) : award.award_type ===
													  "BIGGEST_PROFIT" ? (
														<CircleDollarSign className='h-4 w-4 text-rank-1' />
													) : award.award_type ===
													  "MOST_DUEL_WINS" ? (
														<Crosshair className='h-4 w-4 text-primary' />
													) : award.award_type ===
													  "MOST_POINTS_RISKED" ? (
														<CoinsIcon className='h-4 w-4 text-accent' />
													) : (
														<SparklesIcon className='h-4 w-4 text-cyan-500' />
													)}
													{getSeriesAwardLabel(
														award.award_type,
													)}
												</p>
												<p className='text-xs text-muted-foreground'>
													{award.username}
												</p>
												<p className='text-xs text-muted-foreground'>
													{award.description}
												</p>
											</div>
											{award.collected_at ? (
												<Badge className='bg-muted text-foreground text-[11px]'>
													Collected
												</Badge>
											) : null}
										</div>
									</div>
								))}
							</div>
						) : (
							<div className='rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground'>
								No awards available yet.
							</div>
						)}
					</section>
				</>
			) : (
				<section className='space-y-3'>
					<h3 className='text-lg font-semibold'>Open predictions</h3>
					<InPlayPredictions
						predictionsOverride={seriesOpenPredictions}
						emptyMessage='No open predictions in this series yet.'
						showSectionHeader={false}
					/>
				</section>
			)}

			<section className='space-y-3'>
				<UserStats
					showControls={false}
					title='Leaderboard'
					subtitle='Current standings for this series.'
					leaderboardEntriesOverride={seriesLeaderboard}
					isLeaderboardLoadingOverride={isSeriesLeaderboardLoading}
					showSeeAllLink={false}
				/>
			</section>

			<section className='space-y-3 mt-8'>
				<h3 className={`text-lg font-semibold`}>
					Completed predictions
				</h3>
				<PredictionHistoryFeed
					entries={seriesCompletedPredictions}
					isLoading={isCompletedPredictionsLoading}
					emptyMessage='Completed predictions for this series will appear here soon.'
				/>
			</section>

			{isOrganizer ? (
				<div
					className='fixed right-8 z-50 bottom-2'
					style={
						{
							// bottom: "calc(2rem + env(safe-area-inset-bottom))",
						}
					}
				>
					<Button
						type='button'
						variant='linear'
						size='icon-lg'
						className='rounded-full shadow-lg'
						onClick={onNewPrediction}
						aria-label='New prediction'
					>
						<RocketIcon />
					</Button>
				</div>
			) : null}

			{uncollectedRewards.length > 0 ? (
				<div className='fixed inset-x-0 bottom-3 z-40 mx-auto w-[calc(100%-2rem)] max-w-md'>
					<Button
						type='button'
						variant='linear'
						className='h-11 w-full rounded-full shadow-lg'
						onClick={() => setIsCollectDialogOpen(true)}
					>
						Collect rewards
					</Button>
				</div>
			) : null}

			<SeriesEditDialog
				open={isEditorOpen}
				onOpenChange={onEditDialogOpenChange}
				isUpdatePending={isUpdatePending}
				formState={formState}
				onFormStateChange={onFormStateChange}
				onCancel={onCancelEdit}
				onSave={onSaveEdit}
			/>

			<Button
				variant='secondary'
				onClick={onBackToList}
				aria-label='Back to series'
				className={`sticky bottom-8 left-8 border border-muted-foreground/20 backdrop-blur-sm rounded-2xl
                    transition-all duration-300 ease-out overflow-hidden
                    ${compactBackButton ? "w-10 px-0 justify-center gap-0" : "w-auto px-3 justify-start"}
                `}
				size={compactBackButton ? "icon-lg" : "default"}
			>
				<ChevronLeftIcon className='size-5 shrink-0' />
				<span
					className={`ml-2 whitespace-nowrap transition-all duration-300 ease-out
                        ${compactBackButton ? "max-w-0 w-0 opacity-0 -translate-x-1 ml-0" : "max-w-32 opacity-100 translate-x-0"}
                    `}
				>
					Back to series
				</span>
			</Button>

			<Dialog open={isCollectDialogOpen} onOpenChange={setIsCollectDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Collect your rewards</DialogTitle>
						<DialogDescription>
							Review and collect all unclaimed series rewards.
						</DialogDescription>
					</DialogHeader>

					<Carousel
						setApi={setCollectCarouselApi}
						opts={{ loop: false }}
						className='w-full'
					>
						<CarouselContent className='ml-0'>
							{uncollectedRewards.map((reward) => (
								<CarouselItem key={reward.key} className='pl-0'>
									<div className='rounded-xl border border-border/60 bg-card p-4'>
										<p className='text-xs text-muted-foreground'>
											Reward
										</p>
										<p className='text-lg font-semibold'>
											{reward.title}
										</p>
										<p className='text-sm text-muted-foreground'>
											{reward.subtitle}
										</p>
										<p className='mt-2 text-sm'>
											{reward.description}
										</p>
									</div>
								</CarouselItem>
							))}
						</CarouselContent>
					</Carousel>

					<div className='flex justify-center gap-2'>
						{uncollectedRewards.map((reward, index) => (
							<button
								key={reward.key}
								type='button'
								onClick={() => collectCarouselApi?.scrollTo(index)}
								className={`h-2 rounded-full transition-all ${
									index === collectCurrentSlide
										? "w-6 bg-primary"
										: "w-2 bg-muted-foreground/30"
								}`}
								aria-label={`Go to reward ${index + 1}`}
							/>
						))}
					</div>

					<DialogFooter className='flex-row gap-2 sm:justify-between'>
						<Button
							type='button'
							variant='ghost'
							className='flex-1'
							onClick={() => setIsCollectDialogOpen(false)}
							disabled={isCollectRewardsPending}
						>
							Later
						</Button>
						<Button
							type='button'
							variant='linear'
							className='flex-1'
							onClick={() => {
								onCollectRewards();
								setIsCollectDialogOpen(false);
							}}
							disabled={isCollectRewardsPending}
						>
							Collect all
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
