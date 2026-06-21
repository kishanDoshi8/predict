import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Badge,
	Skeleton,
} from "@/components";
import {
	useRoomMemberRecentPredictions,
	useRoomMemberStats,
} from "@/store/leaderboard";

const statsLabels = [
	{ key: "current_points", label: "Current Points" },
	{ key: "current_rating", label: "Current Rating" },
	{ key: "peak_rating", label: "Peak Rating" },
	{ key: "total_predictions", label: "Total Predictions" },
	{ key: "winning_predictions", label: "Winning Predictions" },
	{ key: "total_rated_predictions", label: "Rated Predictions" },
	{ key: "current_win_streak", label: "Current Win Streak" },
	{ key: "highest_win_streak", label: "Highest Win Streak" },
	{ key: "activity_streak", label: "Activity Streak" },
] as const;

type Props = {
	roomId: string;
	playerId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const formatDate = (value: string) =>
	new Date(value).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});

const resultBadgeMeta = {
	won: { label: "Won", className: "bg-win/20 text-win" },
	lost: { label: "Lost", className: "bg-loss/20 text-loss" },
	no_result: { label: "No Result", className: "bg-muted text-muted-foreground" },
} as const;

function StatsSkeleton() {
	return (
		<div className='grid grid-cols-1 sm:grid-cols-3 gap-2'>
			{Array.from({ length: 9 }).map((_, i) => (
				<Skeleton key={i} className='h-18 rounded-lg' />
			))}
		</div>
	);
}

function PredictionsSkeleton() {
	return (
		<div className='space-y-2'>
			{Array.from({ length: 5 }).map((_, i) => (
				<Skeleton key={i} className='h-16 rounded-lg' />
			))}
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

	const error = statsError ?? historyError;
	const errorMessage =
		error instanceof Error
			? error.message
			: "Unable to load this player profile right now.";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-3xl max-h-[85vh] overflow-y-auto'>
				<DialogHeader>
					<DialogTitle>{stats?.username ?? "Player profile"}</DialogTitle>
					<DialogDescription>Room Performance</DialogDescription>
				</DialogHeader>

				{error ? (
					<div className='rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive'>
						{errorMessage}
					</div>
				) : (
					<div className='space-y-6'>
						<section className='space-y-2'>
							<h3 className='text-sm font-semibold text-muted-foreground'>Stats</h3>
							{isStatsLoading || !stats ? (
								<StatsSkeleton />
							) : (
								<div className='grid grid-cols-1 sm:grid-cols-3 gap-2'>
									{statsLabels.map(({ key, label }) => (
										<div key={key} className='rounded-lg border bg-card/40 p-3'>
											<p className='text-xs text-muted-foreground'>{label}</p>
											<p className='text-lg font-semibold tabular-nums'>
												{stats[key].toLocaleString()}
											</p>
										</div>
									))}
								</div>
							)}
						</section>

						<section className='space-y-2'>
							<h3 className='text-sm font-semibold text-muted-foreground'>Recent Predictions</h3>
							{isHistoryLoading ? (
								<PredictionsSkeleton />
							) : recentPredictions.length === 0 ? (
								<div className='rounded-lg border border-border/60 p-4 text-sm text-muted-foreground'>
									No resolved predictions yet.
								</div>
							) : (
								<div className='space-y-2'>
									{recentPredictions.map((entry) => {
										const resultMeta = resultBadgeMeta[entry.result];
										return (
											<div key={entry.prediction_id} className='rounded-lg border p-3 flex flex-col gap-1'>
												<div className='flex items-start justify-between gap-2'>
													<p className='font-medium text-sm'>{entry.prediction_title}</p>
													<Badge className={resultMeta.className}>{resultMeta.label}</Badge>
												</div>
												<p className='text-xs text-muted-foreground'>Selected: {entry.selected_option}</p>
												<p className='text-xs text-muted-foreground'>Resolved: {formatDate(entry.resolved_at)}</p>
											</div>
										);
									})}
								</div>
							)}
						</section>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
