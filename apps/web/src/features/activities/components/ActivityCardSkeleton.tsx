import { Skeleton } from "@/shared/ui";

// Stands in for ActivityCard: icon, type badge and time, title, summary
// box, a badge and the "Open" pill, with the card's own spacing.
export function ActivityCardSkeleton() {
	return (
		<div aria-hidden='true' className='rounded-2xl border bg-card px-4 py-3.5'>
			<div className='flex items-start gap-3.5'>
				<Skeleton className='mt-0.5 size-8 shrink-0' />
				<div className='min-w-0 flex-1'>
					<div className='flex items-center justify-between gap-1.5'>
						<Skeleton className='h-5 w-20 rounded-full' />
						<Skeleton className='h-4 w-24' />
					</div>
					<Skeleton className='mt-2 h-6 w-3/4' />
					<Skeleton className='mt-2.5 h-8 w-full' />
					<Skeleton className='mt-2.5 h-5 w-16 rounded-full' />
				</div>
			</div>
			<div className='mt-2 flex justify-end'>
				<Skeleton className='h-5 w-14 rounded-full' />
			</div>
		</div>
	);
}

export function ActivityFeedSkeleton({ count = 4 }: Readonly<{ count?: number }>) {
	return (
		<div className='space-y-3'>
			{Array.from({ length: count }).map((_, index) => (
				<ActivityCardSkeleton key={index} />
			))}
		</div>
	);
}
