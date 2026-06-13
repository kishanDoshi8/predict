import {
    getRoomLeaderboard,
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
