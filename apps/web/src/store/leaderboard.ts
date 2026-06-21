import {
    getRoomLeaderboard,
    getRoomMemberRecentPredictions,
    getRoomMemberStats,
    getRoomPredictionHistory,
    getRoomWeeklyLeaderboard,
} from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { roomKeys } from './_keys'

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

export const usePredictionHistory = (roomId?: string) => {
    return useQuery({
        queryKey: roomKeys.predictionHistory(roomId ?? ''),
        queryFn: () => getRoomPredictionHistory(roomId ?? ''),
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
