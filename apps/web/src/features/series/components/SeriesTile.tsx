import { SeriesStatusBadge } from "@/features/series/components/SeriesStatusBadge";
import { getSeriesProgress } from "@/features/series/lib/progress";
import type { Series } from "@/features/series/types/series";
import { Field, FieldLabel, Progress, Skeleton } from "@/shared/ui";
import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/shared/lib/utils";

const TILE_SHELL = "block rounded-2xl border bg-card p-4";

type SeriesTileProps = {
	series: Series;
	roomCode: string;
	/** The series the room view is following right now. */
	isCurrent?: boolean;
};

export function SeriesTile({
	series,
	roomCode,
	isCurrent = false,
}: Readonly<SeriesTileProps>) {
	const progress = getSeriesProgress(series);
	const isCompleted = series.status === "completed";

	return (
		<Link
			to={`/rooms/${roomCode}/series/${series.id}`}
			className={cn(
				TILE_SHELL,
				"transition-colors hover:border-primary/50",
				isCurrent && "border-primary/40",
			)}
			aria-current={isCurrent ? "true" : undefined}
		>
			<div className='space-y-3'>
				<div className='flex items-start justify-between gap-2'>
					<SeriesStatusBadge status={series.status} />
					<span className='flex items-center gap-2'>
						{isCurrent ? <ViewingMark /> : null}
						<ChevronRightIcon className='size-4 text-muted-foreground' />
					</span>
				</div>

				<div className='space-y-1'>
					<p className='text-base font-semibold'>{series.title}</p>
					{series.description?.trim() && (
						<p className='truncate text-sm text-muted-foreground'>
							{series.description?.trim()}
						</p>
					)}
				</div>

				{progress.isOpenEnded ? null : (
					<div>
						<Field>
							<FieldLabel>
								<p className='text-xs text-muted-foreground mr-auto'>
									{progress.resolved} / {progress.expected}
								</p>
								<p>{progress.percent}%</p>
							</FieldLabel>
							<Progress
								value={progress.percent}
								indicatorBgClassName={
									isCompleted
										? "bg-win"
										: "bg-linear-to-r from-primary to-accent"
								}
								className={`-mt-1`}
							/>
						</Field>
					</div>
				)}

				<div className='text-sm text-muted-foreground'>
					{isCompleted ? (
						<span className='inline-flex items-center gap-1 text-win'>
							<CheckCircle2Icon className='size-4' />
							Completed
						</span>
					) : progress.isOpenEnded ? (
						<span>
							{progress.resolved} resolved · {progress.open} open
						</span>
					) : (
						<span>{progress.remaining} games left</span>
					)}
				</div>
			</div>
		</Link>
	);
}

// Same tile with placeholders: status + chevron, title, progress, footer line.
export function SeriesTileSkeleton() {
	return (
		<div aria-hidden='true' className={TILE_SHELL}>
			<div className='space-y-3'>
				<div className='flex items-start justify-between gap-2'>
					<Skeleton className='h-5.5 w-16 rounded-full' />
					<Skeleton className='size-4' />
				</div>
				<div className='flex h-6 items-center'>
					<Skeleton className='h-4 w-40' />
				</div>
				<div className='flex flex-col gap-2'>
					<div className='flex h-6 items-center justify-between'>
						<Skeleton className='h-3 w-12' />
						<Skeleton className='h-4 w-8' />
					</div>
					<Skeleton className='h-2 w-full rounded-full' />
				</div>
				<div className='flex h-5 items-center'>
					<Skeleton className='h-3.5 w-24' />
				</div>
			</div>
		</div>
	);
}

// Quiet marker for the series the whole room view is showing.
export function ViewingMark() {
	return (
		<span className='flex items-center gap-1 text-xs text-muted-foreground'>
			<span aria-hidden='true' className='size-1.5 rounded-full bg-primary' />
			Viewing
		</span>
	);
}
