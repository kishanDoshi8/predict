import { Skeleton } from "@/shared/ui";

// Stands in for PredictionForm while it loads: series, question, two
// options, the deadline picker and the buttons, at their real sizes.
export function PredictionFormSkeleton({
	showSeries = true,
}: Readonly<{ showSeries?: boolean }>) {
	return (
		<div className='p-4' aria-busy='true' aria-label='Loading form'>
			<div className='mx-auto flex w-full max-w-md flex-col gap-7'>
				{showSeries ? (
					<div className='flex flex-col gap-3'>
						<Skeleton className='h-4 w-14' />
						<Skeleton className='h-9 w-full' />
					</div>
				) : null}
				<div className='flex flex-col gap-3'>
					<Skeleton className='h-4 w-28' />
					<Skeleton className='h-16 w-full' />
				</div>
				<div className='flex flex-col gap-3'>
					<Skeleton className='h-4 w-36' />
					{[0, 1].map((i) => (
						<div key={i} className='flex gap-2'>
							<Skeleton className='h-9 flex-1' />
							<Skeleton className='size-9' />
						</div>
					))}
					<Skeleton className='mt-2 h-8 w-full' />
					<Skeleton className='mt-4 h-4 w-32' />
					<Skeleton className='h-9 w-full' />
					<Skeleton className='h-14 w-full' />
				</div>
				<Skeleton className='h-10 w-full' />
				<Skeleton className='-mt-2 h-10 w-full' />
			</div>
		</div>
	);
}
