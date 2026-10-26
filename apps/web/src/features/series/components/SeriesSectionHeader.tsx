import { Badge, Skeleton } from "@/shared/ui";

type SeriesSectionHeaderProps = {
	label: string;
	count: number;
};

export function SeriesSectionHeader({
	label,
	count,
}: Readonly<SeriesSectionHeaderProps>) {
	return (
		<div className='flex items-center justify-between'>
			<h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
				{label}
			</h3>
			<Badge
				variant='secondary'
				className='rounded-full px-2 py-0.5 text-xs'
			>
				{count}
			</Badge>
		</div>
	);
}

export function SeriesSectionHeaderSkeleton() {
	return (
		<div className='flex h-5.5 items-center justify-between'>
			<Skeleton className='h-3 w-14' />
			<Skeleton className='h-5.5 w-6 rounded-full' />
		</div>
	);
}
