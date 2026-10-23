import { ToggleGroup, ToggleGroupItem } from "@/shared/ui";

export type SeriesScope = "series" | "all";

type Props = {
	value: SeriesScope;
	onValueChange: (value: SeriesScope) => void;
	seriesTitle?: string | null;
};

// "This series" follows the series picked in the room header.
export function SeriesScopeToggle({
	value,
	onValueChange,
	seriesTitle,
}: Readonly<Props>) {
	return (
		<ToggleGroup
			type='single'
			variant='outline'
			value={value}
			onValueChange={(next) => {
				if (next === "series" || next === "all") onValueChange(next);
			}}
			className='w-full'
			aria-label='Which series to show'
		>
			<ToggleGroupItem value='series' className='flex-1 min-w-0'>
				<span className='truncate'>{seriesTitle ?? "This series"}</span>
			</ToggleGroupItem>
			<ToggleGroupItem value='all' className='flex-1'>
				All series
			</ToggleGroupItem>
		</ToggleGroup>
	);
}
