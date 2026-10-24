import { useRoomContext } from "@/app/layouts/RoomLayout";
import { usePlayer } from "@/features/home";
import { useSeriesLeaderboard } from "@/features/leaderboard";
import { useActivePredictions } from "@/features/predictions";
import {
	SeriesStatusBadge,
	useCurrentSeries,
	useSeriesWallet,
} from "@/features/series";
import { describeDeadline } from "@/shared/lib/deadline";
import { cn, formatSignedPoints } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/ui";
import { ChevronRightIcon, Clock } from "lucide-react";
import { Link } from "react-router-dom";

// Where you stand in the series you're looking at, and what locks next.
export function SeriesHeroCard() {
	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const { currentSeries, currentSeriesId, isPending: isSeriesLoading } =
		useCurrentSeries(room.id);
	const { wallet, isPending: isWalletLoading } = useSeriesWallet(
		room.id,
		currentSeriesId,
	);
	const { data: standings = [] } = useSeriesLeaderboard(
		room.id,
		currentSeriesId,
	);
	const { data: predictions = [] } = useActivePredictions(
		room.id,
		currentSeriesId ?? undefined,
	);

	if (isSeriesLoading || (currentSeriesId && isWalletLoading)) {
		return <Skeleton className='h-36 w-full max-w-md mx-auto rounded-2xl' />;
	}
	if (!currentSeries || !wallet) return null;

	const myRank = standings.find((entry) => entry.player_id === player?.id)?.rank;
	const now = Date.now();
	const nextLock = predictions
		.filter(
			(prediction) =>
				prediction.status === "draft" &&
				new Date(prediction.deadline).getTime() > now,
		)
		.sort(
			(a, b) =>
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
		)[0];
	const nextLockWhen = nextLock
		? describeDeadline(new Date(nextLock.deadline)).when
		: null;

	return (
		<section
			aria-label={`${currentSeries.title} summary`}
			className='w-full max-w-md mx-auto rounded-2xl border bg-card p-4'
		>
			<div className='flex items-center justify-between gap-2'>
				<p className='truncate text-sm font-medium text-muted-foreground'>
					{currentSeries.title}
				</p>
				<SeriesStatusBadge status={currentSeries.status} />
			</div>

			<div className='mt-2 flex items-end justify-between gap-4'>
				<div>
					<p className='text-xs text-muted-foreground'>Your rank</p>
					<p className='text-3xl font-bold leading-tight'>
						{myRank ? `#${myRank}` : "–"}
						{standings.length > 0 ? (
							<span className='ml-1 text-base font-medium text-muted-foreground'>
								of {standings.length}
							</span>
						) : null}
					</p>
				</div>
				<div className='text-right'>
					<p className='text-xs text-muted-foreground'>Balance</p>
					<p className='text-3xl font-bold leading-tight'>
						{wallet.balance.toLocaleString()}
						<span className='ml-1 text-base font-medium text-muted-foreground'>
							pts
						</span>
					</p>
					<p
						className={cn(
							"text-xs font-medium",
							wallet.net_profit > 0
								? "text-win"
								: wallet.net_profit < 0
									? "text-destructive"
									: "text-muted-foreground",
						)}
					>
						{formatSignedPoints(wallet.net_profit)} this series
					</p>
				</div>
			</div>

			<p className='mt-2 text-xs text-muted-foreground'>
				{wallet.escrow.toLocaleString()} in play ·{" "}
				{wallet.available.toLocaleString()} to spend
			</p>

			{nextLock && nextLockWhen ? (
				<Link
					to={`/rooms/${room.code}/predictions/${nextLock.id}`}
					className='mt-3 flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
				>
					<Clock className='size-4 shrink-0 text-muted-foreground' />
					<span className='min-w-0 flex-1'>
						<span className='block truncate font-medium'>
							{nextLock.title}
						</span>
						<span className='block text-xs text-muted-foreground'>
							Locks {nextLockWhen}
						</span>
					</span>
					<ChevronRightIcon className='size-4 shrink-0 text-muted-foreground' />
				</Link>
			) : null}
		</section>
	);
}
