import { useEffect, useMemo } from "react";
import { cn } from "@/shared/lib/utils";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/shared/ui/combobox";
import { SeriesSelectorMode } from "@/shared/lib/api";
import { useSeriesSelector } from "@/features/series/hooks/series";

const ALL_SERIES_VALUE = "__all_series__";

type SeriesSelectorItem = {
	value: string;
	label: string;
};

type SeriesSelectorProps = {
	roomId?: string;
	mode: SeriesSelectorMode;
	value?: string | null;
	onValueChange: (value: string | null) => void;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	optional?: boolean;
	autoSelect?: boolean;
	allLabel?: string;
	emptyMessage?: string;
};

export function SeriesSelector({
	roomId,
	mode,
	value,
	onValueChange,
	placeholder = "Select series",
	className,
	disabled = false,
	optional = false,
	autoSelect = false,
	allLabel = "All series",
	emptyMessage = "No series found.",
}: Readonly<SeriesSelectorProps>) {
	const { data, isPending } = useSeriesSelector(roomId, mode, value);

	const items = useMemo<SeriesSelectorItem[]>(
		() =>
			[
				...(optional
					? [{ value: ALL_SERIES_VALUE, label: allLabel }]
					: []),
				...(data?.series ?? []).map((series) => ({
					value: series.id,
					label: series.title,
				})),
			],
		[allLabel, data?.series, optional],
	);

	const selectedItem = useMemo(() => {
		const selectedValue = value ?? (optional ? ALL_SERIES_VALUE : null);
		return items.find((item) => item.value === selectedValue) ?? null;
	}, [items, optional, value]);

	useEffect(() => {
		if (!autoSelect || value || !data?.selected_series_id) {
			return;
		}
		onValueChange(data.selected_series_id);
	}, [autoSelect, data?.selected_series_id, onValueChange, value]);

	return (
		<Combobox
			value={selectedItem}
			onValueChange={(nextValue) =>
				onValueChange(
					nextValue?.value === ALL_SERIES_VALUE
						? null
						: (nextValue?.value ?? null),
				)
			}
			itemToStringLabel={(item) => item.label}
			itemToStringValue={(item) => item.value}
		>
			<ComboboxInput
				className={cn("w-full", className)}
				placeholder={isPending ? "Loading series..." : placeholder}
				disabled={disabled || isPending || items.length === 0}
				showClear={optional && Boolean(value)}
			/>
			<ComboboxContent>
				<ComboboxList>
					<ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
					{items.map((item) => (
						<ComboboxItem key={item.value} value={item}>
							{item.label}
						</ComboboxItem>
					))}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
