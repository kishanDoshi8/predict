import { SeriesOrganizerActionsMenu } from "@/features/series/components/SeriesOrganizerActionsMenu";
import { SeriesStatusBadge } from "@/features/series/components/SeriesStatusBadge";
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
	const expectedGames = Math.max(series.expectedGames, 0);
	const completedGames = Math.max(series.completedGames, 0);
	const remainingGames = Math.max(expectedGames - completedGames, 0);
	const progressValue =
		expectedGames > 0
			? Math.min((completedGames / expectedGames) * 100, 100)
			: 0;

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
				<Field>
					<FieldLabel>
						<p className='text-xs text-muted-foreground mr-auto'>
							{completedGames} / {expectedGames}
						</p>
						<p>
							{expectedGames > 0
								? Math.min(
										(completedGames / expectedGames) * 100,
										100,
									)
								: 0}
							%
						</p>
					</FieldLabel>
					<Progress
						value={progressValue}
						indicatorBgClassName={
							series.status === "completed"
								? "bg-win"
								: "bg-linear-to-r from-primary to-accent"
						}
						className={`-mt-1`}
					/>
				</Field>
				<div className='grid grid-cols-3 gap-2 text-center text-xs'>
					<div className='rounded-lg border p-2'>
						<p className='text-muted-foreground'>Expected</p>
						<p className='mt-1 text-sm font-semibold'>
							{expectedGames}
						</p>
					</div>
					<div className='rounded-lg border p-2'>
						<p className='text-muted-foreground'>Completed</p>
						<p className='mt-1 text-sm font-semibold'>
							{completedGames}
						</p>
					</div>
					<div className='rounded-lg border p-2'>
						<p className='text-muted-foreground'>Remaining</p>
						<p className='mt-1 text-sm font-semibold'>
							{remainingGames}
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
