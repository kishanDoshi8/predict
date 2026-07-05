import {
	PredictionHistoryFeed,
	usePredictionHistory,
	PredictionHistoryFilter,
} from "@/features/leaderboard";
import { useRoomContext } from "@/app/layouts/RoomLayout";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input, Button } from "@/shared/ui";
import { Skeleton } from "@/shared/ui/skeleton";

const FILTERS: Array<{ label: string; value: PredictionHistoryFilter }> = [
	{ label: "All", value: "all" },
	{ label: "Wins", value: "wins" },
	{ label: "Losses", value: "losses" },
	{ label: "My Bets", value: "my_bets" },
];

function emptyStateMessage(filter: PredictionHistoryFilter, search: string) {
	if (search.trim().length > 0) {
		return "No predictions match your search.";
	}

	switch (filter) {
		case "wins":
			return "No wins found.";
		case "losses":
			return "No losses found.";
		case "my_bets":
			return "You haven't placed any bets yet.";
		default:
			return "No history available.";
	}
}

function HistoryFeed() {
	const { room } = useRoomContext();
	const [filter, setFilter] = useState<PredictionHistoryFilter>("all");
	const [searchInput, setSearchInput] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const loadMoreRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const timeoutId = globalThis.setTimeout(() => {
			setDebouncedSearch(searchInput.trim());
		}, 300);

		return () => globalThis.clearTimeout(timeoutId);
	}, [searchInput]);

	const {
		data,
		isPending: isHistoryLoading,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
	} = usePredictionHistory(room.id, filter, debouncedSearch);

	const history = useMemo(
		() => data?.pages.flatMap((page) => page.items) ?? [],
		[data],
	);

	useEffect(() => {
		const node = loadMoreRef.current;
		if (!node || !hasNextPage) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const first = entries[0];
				if (
					first?.isIntersecting &&
					hasNextPage &&
					!isFetchingNextPage
				) {
					void fetchNextPage();
				}
			},
			{
				rootMargin: "200px 0px",
			},
		);

		observer.observe(node);
		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	return (
		<div className={`flex flex-col gap-4 py-4 max-w-lg mx-auto w-full`}>
			{/* Section heading */}
			<div>
				<h2 className='text-lg font-semibold'>Blast from the Past</h2>
				<p className='text-sm text-muted-foreground'>
					Relive the glory (or agony) of previous predictions.
				</p>
			</div>

			<div className='space-y-3'>
				<Input
					type='search'
					placeholder='Search prediction titles...'
					value={searchInput}
					onChange={(event) => setSearchInput(event.target.value)}
				/>
				<div className='flex flex-wrap gap-2'>
					{FILTERS.map((item) => (
						<Button
							key={item.value}
							size='sm'
							variant={
								filter === item.value ? "default" : "outline"
							}
							onClick={() => setFilter(item.value)}
						>
							{item.label}
						</Button>
					))}
				</div>
			</div>

			<PredictionHistoryFeed
				entries={history}
				isLoading={isHistoryLoading}
				emptyMessage={emptyStateMessage(filter, debouncedSearch)}
			/>

			<div ref={loadMoreRef} className='h-4' />

			{isFetchingNextPage && (
				<div className='flex flex-col gap-4'>
					{Array.from({ length: 2 }).map((_, index) => (
						<Skeleton
							key={index}
							className='h-46 w-full rounded-xl'
						/>
					))}
				</div>
			)}
		</div>
	);
}

export default HistoryFeed;
