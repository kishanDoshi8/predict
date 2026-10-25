import { SeriesOrganizerActionsMenu } from "@/features/series/components/SeriesOrganizerActionsMenu";
import { SeriesStatusBadge } from "@/features/series/components/SeriesStatusBadge";
import { getSeriesProgress } from "@/features/series/lib/progress";
import type { Series } from "@/features/series/types/series";
import { Field, FieldLabel, Progress } from "@/shared/ui";

type SeriesOverviewCardProps = {
	series: Series;
	isOrganizer: boolean;
	isActionPending: boolean;
	onEdit: () => void;
	onArchive: () => void;
	onCloseSeries: () => void;
};

export function SeriesOverviewCard({
	series,
	isOrganizer,
	isActionPending,
	onEdit,
	onArchive,
	onCloseSeries,
}: Readonly<SeriesOverviewCardProps>) {
	const progress = getSeriesProgress(series);
	const stats = progress.isOpenEnded
		? [
				{ label: "Resolved", value: progress.resolved },
				{ label: "Open", value: progress.open },
				{ label: "Cancelled", value: series.cancelledPredictions },
			]
		: [
				{ label: "Expected", value: progress.expected },
				{ label: "Completed", value: progress.resolved },
				{ label: "Remaining", value: progress.remaining },
			];

	return (
		<section className='rounded-2xl'>
			<SeriesStatusBadge status={series.status} />
			<div className='flex items-start justify-between gap-3 mt-2'>
				<h2 className='text-lg font-semibold leading-tight my-auto'>
					{series.title}
				</h2>
				{isOrganizer ? (
					<SeriesOrganizerActionsMenu
						series={series}
						isPending={isActionPending}
						onEdit={onEdit}
						onArchive={onArchive}
						onCloseSeries={onCloseSeries}
					/>
				) : null}
			</div>
			{series.description?.trim() && (
				<p className='text-sm text-muted-foreground'>
					{series.description.trim()}
				</p>
			)}

			<div className='mt-2 space-y-3 rounded-xl border bg-card p-3'>
				{progress.isOpenEnded ? (
					<p className='text-xs text-muted-foreground'>
						Open-ended: no set number of games.
					</p>
				) : (
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
								series.status === "completed"
									? "bg-win"
									: "bg-linear-to-r from-primary to-accent"
							}
							className={`-mt-1`}
						/>
					</Field>
				)}
				<div className='grid grid-cols-3 gap-2 text-center text-xs'>
					{stats.map((stat) => (
						<div key={stat.label} className='rounded-lg border p-2'>
							<p className='text-muted-foreground'>{stat.label}</p>
							<p className='mt-1 text-sm font-semibold'>
								{stat.value}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
