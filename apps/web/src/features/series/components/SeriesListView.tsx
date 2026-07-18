import { SeriesSectionHeader } from "@/features/series/components/SeriesSectionHeader";
import { SeriesTile } from "@/features/series/components/SeriesTile";
import type { Series } from "@/features/series/types/series";
import { Button, Skeleton } from "@/shared/ui";
import { PlusIcon } from "lucide-react";

type SeriesListViewProps = {
	isPending: boolean;
	activeSeries: Series[];
	completedSeries: Series[];
	roomCode: string;
	isOrganizer: boolean;
	onCreateNew: () => void;
};

export function SeriesListView({
	isPending,
	activeSeries,
	completedSeries,
	roomCode,
	isOrganizer,
	onCreateNew,
}: Readonly<SeriesListViewProps>) {
	return (
		<div className='mx-auto w-full max-w-md space-y-5 p-4'>
			<div>
				<div className={`flex items-center justify-between`}>
					<h2 className='flex-1 text-lg font-semibold'>Series</h2>
					{isOrganizer && (
						<Button
							className={`rounded-2xl`}
							variant='secondary'
							size='sm'
							onClick={onCreateNew}
						>
							<PlusIcon className='h-4 w-4' />
							New
						</Button>
					)}
				</div>
				<p className='mt-1 text-sm text-muted-foreground'>
					Browse active and completed runs.
				</p>
			</div>

			{isPending ? (
				<div className='space-y-3'>
					<Skeleton className='h-32 w-full rounded-2xl' />
					<Skeleton className='h-32 w-full rounded-2xl' />
				</div>
			) : (
				<>
					<section className='space-y-3'>
						<SeriesSectionHeader
							label='Active'
							count={activeSeries.length}
						/>
						{activeSeries.length === 0 ? (
							<p className='text-sm text-muted-foreground'>
								No active series.
							</p>
						) : (
							<div className='space-y-3'>
								{activeSeries.map((series) => (
									<SeriesTile
										key={series.id}
										series={series}
										roomCode={roomCode}
									/>
								))}
							</div>
						)}
					</section>

					<section className='space-y-3'>
						<SeriesSectionHeader
							label='Completed'
							count={completedSeries.length}
						/>
						{completedSeries.length === 0 ? (
							<p className='text-sm text-muted-foreground'>
								No completed series.
							</p>
						) : (
							<div className='space-y-3'>
								{completedSeries.map((series) => (
									<SeriesTile
										key={series.id}
										series={series}
										roomCode={roomCode}
									/>
								))}
							</div>
						)}
					</section>
				</>
			)}
		</div>
	);
}
