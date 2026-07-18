import { Badge } from "@/shared/ui";

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
