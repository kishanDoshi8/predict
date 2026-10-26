import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/ui";

// Stands in for TopThreePodium: 2nd | 1st | 3rd with medal, avatar, name,
// two value lines and the pedestal.
export function TopThreePodiumSkeleton() {
	return (
		<div
			aria-hidden='true'
			className='flex items-end justify-center gap-2 pt-4 pb-2'
		>
			{[2, 1, 3].map((place) => {
				const isFirst = place === 1;
				return (
					<div
						key={place}
						className='flex flex-1 flex-col items-center gap-1'
					>
						<Skeleton className='size-6 rounded-full' />
						<Skeleton
							className={cn(
								"rounded-full",
								isFirst ? "size-14" : "size-10",
							)}
						/>
						<Skeleton className='h-4 w-16' />
						<Skeleton className='h-3 w-14' />
						<Skeleton className='h-2.5 w-10' />
						<Skeleton
							className={cn(
								"w-full rounded-b-none rounded-t-md",
								isFirst ? "h-12" : place === 2 ? "h-8" : "h-6",
							)}
						/>
					</div>
				);
			})}
		</div>
	);
}

// Stands in for a standings row: rank, avatar, name over wins, balance over
// profit.
export function StandingsRowsSkeleton({ rows = 6 }: Readonly<{ rows?: number }>) {
	return (
		<div aria-hidden='true' className='flex flex-col gap-1'>
			{Array.from({ length: rows }).map((_, i) => (
				<div
					key={i}
					className='flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5'
				>
					<Skeleton className='h-5 w-8' />
					<Skeleton className='size-8 rounded-full' />
					<div className='flex flex-1 flex-col gap-1.5'>
						<Skeleton className='h-4 w-24' />
						<Skeleton className='h-3 w-14' />
					</div>
					<div className='flex flex-col items-end gap-1.5'>
						<Skeleton className='h-4 w-16' />
						<Skeleton className='h-3 w-10' />
					</div>
				</div>
			))}
		</div>
	);
}
