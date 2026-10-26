import { Skeleton } from "@/shared/ui";

// Stands in for SeriesTile: status badge, title and description, progress,
// status line.
export function SeriesTileSkeleton() {
	return (
		<div aria-hidden='true' className='rounded-2xl border bg-card p-4'>
			<div className='space-y-3'>
				<div className='flex items-center justify-between'>
					<Skeleton className='h-5 w-16 rounded-full' />
					<Skeleton className='size-4' />
				</div>
				<div className='space-y-1.5'>
					<Skeleton className='h-5 w-40' />
					<Skeleton className='h-4 w-52' />
				</div>
				<div className='space-y-2'>
					<div className='flex justify-between'>
						<Skeleton className='h-3 w-12' />
						<Skeleton className='h-3 w-8' />
					</div>
					<Skeleton className='h-2 w-full' />
				</div>
				<Skeleton className='h-4 w-24' />
			</div>
		</div>
	);
}

// The Active section as it first appears: its header and two tiles.
export function SeriesListSkeleton() {
	return (
		<section className='space-y-3' aria-hidden='true'>
			<div className='flex items-center justify-between'>
				<Skeleton className='h-3 w-14' />
				<Skeleton className='h-5 w-6 rounded-full' />
			</div>
			<div className='space-y-3'>
				<SeriesTileSkeleton />
				<SeriesTileSkeleton />
			</div>
		</section>
	);
}

// Stands in for SeriesOverviewCard: badge, title, description and the
// bordered box with progress and three stats.
export function SeriesOverviewSkeleton() {
	return (
		<section aria-hidden='true'>
			<Skeleton className='h-5 w-16 rounded-full' />
			<Skeleton className='mt-2 h-6 w-48' />
			<Skeleton className='mt-2 h-4 w-56' />
			<div className='mt-2 space-y-3 rounded-xl border bg-card p-3'>
				<div className='space-y-2'>
					<div className='flex justify-between'>
						<Skeleton className='h-3 w-12' />
						<Skeleton className='h-3 w-8' />
					</div>
					<Skeleton className='h-2 w-full' />
				</div>
				<div className='grid grid-cols-3 gap-2'>
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							className='flex flex-col items-center gap-1.5 rounded-lg border p-2'
						>
							<Skeleton className='h-3 w-14' />
							<Skeleton className='h-4 w-6' />
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
