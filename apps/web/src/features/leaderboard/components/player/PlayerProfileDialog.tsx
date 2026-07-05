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
	useRoomMemberStats,
} from "@/features/leaderboard";
import { RatingBadge } from "./RatingBadge";
import {
	CheckIcon,
	CircleDollarSign,
	CircleSlash,
	CoinsIcon,
	Crosshair,
	FlameIcon,
	TargetIcon,
	X,
	ZapIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

const statsLabels = [
	{
		key: "current_points",
		label: "Points Won",
		icon: <CoinsIcon className={`text-rank-1`} size={20} />,
	},
	{
		key: "current_rating",
		label: "Current Rating",
		icon: <ZapIcon className={`text-cyan-500`} size={20} />,
	},
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

const getRankBadgeClassName = (rank?: number) => {
	if (rank === 1) return "bg-rank-1 text-background font-bold";
	if (rank === 2) return "bg-rank-2 text-background font-bold";
	if (rank === 3) return "bg-rank-3 text-background font-bold";
	return "bg-secondary text-secondary-foreground";
};

function StatsSkeleton() {
	return (
		<div className='grid grid-cols-2 gap-4'>
			{Array.from({ length: 4 }).map((_, i) => (
				<Skeleton key={i} className='h-19 rounded-lg' />
			))}
			{Array.from({ length: 2 }).map((_, i) => (
				<Skeleton key={i} className='h-26 rounded-lg col-span-2' />
			))}
		</div>
	);
}

function PredictionsSkeleton() {
	return (
		<div className='space-y-2'>
			<Skeleton className='h-10 rounded-lg' />
		</div>
	);
}

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
		} else {
			setError(null);
		}
	}, [statsError, historyError]);

	const recentPredictionsContent = (() => {
		if (isHistoryLoading) {
			return <PredictionsSkeleton />;
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
						{stats?.username ?? "Player profile"}
					</TitleComponent>
					<DescriptionComponent className={`flex gap-2`}>
						{stats?.highest_win_streak && (
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
						{stats?.current_rating !== undefined && (
							<RatingBadge rating={stats.current_rating ?? 0} />
						)}
					</DescriptionComponent>
				</HeaderComponent>

				{error && (
					<div className='p-4 text-sm text-red-500'>{error}</div>
				)}

				<div className={`p-4 overflow-auto no-scrollbar`}>
					<section className='space-y-2'>
						{isStatsLoading || !stats ? (
							<StatsSkeleton />
						) : (
							<div className='grid grid-cols-2 gap-4'>
								{statsLabels.map(({ key, label, icon }) => (
									<FadeContent
										key={key}
										delay={200}
										className='rounded-lg p-3 bg-card border border-border/60 flex flex-col gap-2'
									>
										<p className='flex justify-between text-xs text-muted-foreground'>
											{label}
											{label === "Points Won" && (
												<span
													className={`text-xs font-bold tracking-wider px-2 rounded-md ${getRankBadgeClassName(
														stats.points_rank,
													)}`}
												>
													#{stats.points_rank}
												</span>
											)}
											{label === "Current Rating" && (
												<span
													className={`text-xs font-bold tracking-wider px-2 rounded-md ${getRankBadgeClassName(
														stats.rating_rank,
													)}`}
												>
													#{stats.rating_rank}
												</span>
											)}
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
									delay={300}
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
												{stats?.largest_win_payout.toLocaleString()}{" "}
												pts
											</span>
										</p>
										<p className='text-xs text-muted-foreground'>
											Bet{" "}
											{stats?.largest_win_bet.toLocaleString()}{" "}
											•{" "}
											{stats?.largest_win_multiplier.toFixed(
												2,
											)}
											x return
										</p>
									</div>
								</FadeContent>
								<FadeContent
									delay={300}
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
						<FadeContent delay={350}>
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
