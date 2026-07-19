import {
    getRoomLeaderboard,
    getRoomMemberRecentPredictions,
    getRoomMemberStats,
    getRoomPredictionHistory,
    getRoomSeriesSelector,
    SeriesSelectorMode,
    getSeriesLeaderboard,
    getRoomWeeklyLeaderboard,
} from '@/shared/lib/api'
import { PredictionHistoryFilter, PredictionHistoryPage } from "@/features/leaderboard";
import { InfiniteData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { roomKeys } from '@/shared/constants/queryKeys'

export type LeaderboardSortBy = 'points' | 'ratings'

const toApiSortBy = (sortBy: LeaderboardSortBy): 'points' | 'rating' => {
    return sortBy === 'ratings' ? 'rating' : 'points'
}

export const useRoomLeaderboard = (
    roomId?: string,
    enabled = true,
    sortBy: LeaderboardSortBy = 'points',
) => {
    return useQuery({
        queryKey: roomKeys.leaderboard(roomId ?? '', sortBy),
        queryFn: () => getRoomLeaderboard(roomId ?? '', toApiSortBy(sortBy)),
        enabled: !!roomId && enabled,
    })
}

export const useRoomWeeklyLeaderboard = (
    roomId?: string,
    enabled = true,
    sortBy: LeaderboardSortBy = 'points',
) => {
    return useQuery({
        queryKey: roomKeys.weeklyLeaderboard(roomId ?? '', sortBy),
        queryFn: () =>
            getRoomWeeklyLeaderboard(roomId ?? '', toApiSortBy(sortBy)),
        enabled: !!roomId && enabled,
    })
}

export const useRoomSeriesSelector = (
    roomId?: string,
    selectedSeriesId?: string | null,
    mode: SeriesSelectorMode = 'active-or-last',
    enabled = true,
) => {
    return useQuery({
        queryKey: roomKeys.seriesSelector(roomId ?? '', mode, selectedSeriesId ?? 'default'),
        queryFn: () => getRoomSeriesSelector(roomId ?? '', selectedSeriesId, mode),
        enabled: !!roomId && enabled,
    })
}

export const useSeriesLeaderboard = (
    roomId?: string,
    seriesId?: string | null,
    enabled = true,
    sortBy: LeaderboardSortBy = 'points',
) => {
    return useQuery({
        queryKey: roomKeys.seriesLeaderboard(roomId ?? '', seriesId ?? '', sortBy),
        queryFn: () =>
            getSeriesLeaderboard(roomId ?? '', seriesId ?? '', toApiSortBy(sortBy)),
        enabled: !!roomId && !!seriesId && enabled,
    })
}

type PredictionHistoryCursor = {
    cursorCreatedAt: string | null
    cursorId: string | null
}

const DEFAULT_PREDICTION_HISTORY_LIMIT = 20

export const usePredictionHistory = (
    roomId?: string,
    filter: PredictionHistoryFilter = 'all',
    search = '',
    seriesId?: string,
) => {
    const initialCursor: PredictionHistoryCursor = {
        cursorCreatedAt: null,
        cursorId: null,
    }

    return useInfiniteQuery<
        PredictionHistoryPage,
        Error,
        InfiniteData<PredictionHistoryPage, PredictionHistoryCursor>,
        readonly [string, string, PredictionHistoryFilter, string, string],
        PredictionHistoryCursor
    >({
        queryKey: ['prediction-history', roomId ?? '', filter, search, seriesId ?? 'all'],
        queryFn: ({ pageParam }) =>
            getRoomPredictionHistory({
                roomId: roomId ?? '',
                limit: DEFAULT_PREDICTION_HISTORY_LIMIT,
                cursorCreatedAt: pageParam.cursorCreatedAt,
                cursorId: pageParam.cursorId,
                search,
                filter,
                seriesId,
            }),
        initialPageParam: initialCursor,
        getNextPageParam: (lastPage) => {
            if (!lastPage.has_more) return undefined
            if (!lastPage.next_cursor_created_at || !lastPage.next_cursor_id) {
                return undefined
            }

            return {
                cursorCreatedAt: lastPage.next_cursor_created_at,
                cursorId: lastPage.next_cursor_id,
            } satisfies PredictionHistoryCursor
        },
        enabled: !!roomId,
    })
}


export const useRoomMemberStats = (
    roomId?: string,
    playerId?: string | null,
    enabled = true,
) => {
    return useQuery({
        queryKey: roomKeys.roomMemberStats(roomId ?? "", playerId ?? ""),
        queryFn: () => getRoomMemberStats(roomId ?? "", playerId ?? ""),
        enabled: !!roomId && !!playerId && enabled,
    })
}

export const useRoomMemberRecentPredictions = (
    roomId?: string,
    playerId?: string | null,
    limit = 5,
    offset = 0,
    enabled = true,
) => {
    return useQuery({
        queryKey: roomKeys.roomMemberRecentPredictions(
            roomId ?? "",
            playerId ?? "",
            limit,
            offset,
        ),
        queryFn: () =>
            getRoomMemberRecentPredictions(
                roomId ?? "",
                playerId ?? "",
                limit,
                offset,
            ),
        enabled: !!roomId && !!playerId && enabled,
    })
}
