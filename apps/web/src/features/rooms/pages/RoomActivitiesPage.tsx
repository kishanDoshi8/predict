import { useRoomContext } from "@/app/layouts/RoomLayout";
import { useRoomActivities, ActivityFilter } from "@/features/activities";
import { useMarkRoomActivitiesSeen } from "@/features/rooms";
import { RoomActivitiesFeed } from "@/features/activities/components";
import { SeriesSelector } from "@/features/series";
import { Button, Skeleton } from "@/shared/ui";
import { useEffect, useMemo, useRef, useState } from "react";

const FILTERS: Array<{ label: string; value: ActivityFilter }> = [
	{ label: "All", value: "all" },
];

export default function RoomActivitiesPage() {
	const { room } = useRoomContext();
	const [filter, setFilter] = useState<ActivityFilter>("all");
	const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
	const loadMoreRef = useRef<HTMLDivElement | null>(null);
	const hasScheduledSeenRef = useRef(false);
	const { mutate: markActivitiesSeen } = useMarkRoomActivitiesSeen(
		room.code,
		room.id,
	);

	const {
		data,
		isPending,
		isError,
		error,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
	} = useRoomActivities(room.id, filter, selectedSeriesId ?? undefined);

	const activities = useMemo(
		() => data?.pages.flatMap((page) => page.items) ?? [],
		[data],
	);

	useEffect(() => {
		if (
			!room.id ||
			isPending ||
			isError ||
			!data ||
			hasScheduledSeenRef.current
		) {
			return;
		}

		hasScheduledSeenRef.current = true;

		const timerId = globalThis.setTimeout(() => {
			markActivitiesSeen();
		}, 900);

		return () => {
			globalThis.clearTimeout(timerId);
		};
	}, [data, isError, isPending, markActivitiesSeen, room.id]);

	useEffect(() => {
		const node = loadMoreRef.current;
		if (!node || !hasNextPage) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const first = entries[0];
				if (
					first?.isIntersecting &&
					hasNextPage &&
					!isFetchingNextPage
				) {
					fetchNextPage();
				}
			},
			{ rootMargin: "200px 0px" },
		);

		observer.observe(node);
		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	return (
		<div className='mx-auto w-full max-w-lg space-y-4 p-4'>
			<div>
				<h2 className='text-lg font-semibold'>Activities</h2>
				<p className='mt-1 text-sm text-muted-foreground'>
					The social timeline of everything meaningful happening in this
					room.
				</p>
			</div>

			<div className='flex flex-wrap gap-2'>
				{FILTERS.map((item) => (
					<Button
						key={item.value}
						size='sm'
						variant={filter === item.value ? "default" : "outline"}
						onClick={() => setFilter(item.value)}
					>
						{item.label}
					</Button>
				))}
			</div>
			<SeriesSelector
				roomId={room.id}
				mode='all'
				value={selectedSeriesId}
				onValueChange={setSelectedSeriesId}
				placeholder='Filter by series'
				optional
			/>

			<RoomActivitiesFeed
				activities={activities}
				roomCode={room.code}
				isLoading={isPending}
				isError={isError}
				errorMessage={error instanceof Error ? error.message : undefined}
				emptyMessage={
					selectedSeriesId
						? "No activities found for this Series."
						: undefined
				}
			/>

			<div ref={loadMoreRef} className='h-4' />

			{isFetchingNextPage ? (
				<div className='space-y-3'>
					{Array.from({ length: 2 }).map((_, index) => (
						<Skeleton key={index} className='h-24 w-full rounded-2xl' />
					))}
				</div>
			) : null}
		</div>
	);
}
