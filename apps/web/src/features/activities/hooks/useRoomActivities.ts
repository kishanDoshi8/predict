import { InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import {
	ActivityFilter,
	RoomActivitiesPage,
} from "@/features/activities/types/types";
import { getRoomActivities } from "@/shared/lib/api";
import { roomKeys } from "@/shared/constants/queryKeys";

type ActivityCursor = {
	cursorCreatedAt: string | null;
	cursorId: string | null;
};

const DEFAULT_ACTIVITY_LIMIT = 20;

export const useRoomActivities = (
	roomId?: string,
	filter: ActivityFilter = "all",
	seriesId?: string | null,
) => {
	const initialCursor: ActivityCursor = {
		cursorCreatedAt: null,
		cursorId: null,
	};

	return useInfiniteQuery<
		RoomActivitiesPage,
		Error,
		InfiniteData<RoomActivitiesPage, ActivityCursor>,
		ReturnType<typeof roomKeys.activities>,
		ActivityCursor
	>({
		queryKey: roomKeys.activities(roomId ?? "", filter, seriesId ?? "all"),
		queryFn: ({ pageParam }) =>
			getRoomActivities({
				roomId: roomId ?? "",
				limit: DEFAULT_ACTIVITY_LIMIT,
				cursorCreatedAt: pageParam.cursorCreatedAt,
				cursorId: pageParam.cursorId,
				filter,
				seriesId,
			}),
		initialPageParam: initialCursor,
		getNextPageParam: (lastPage) => {
			if (!lastPage.has_more) {
				return undefined;
			}

			if (
				!lastPage.next_cursor_created_at ||
				!lastPage.next_cursor_id
			) {
				return undefined;
			}

			return {
				cursorCreatedAt: lastPage.next_cursor_created_at,
				cursorId: lastPage.next_cursor_id,
			} satisfies ActivityCursor;
		},
		enabled: !!roomId,
	});
};
