import {
    getRoomLeaderboard,
    getRoomPredictionHistory,
    getRoomWeeklyLeaderboard,
} from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { roomKeys } from './_keys'

export const useRoomLeaderboard = (roomId?: string, enabled = true) => {
    return useQuery({
        queryKey: roomKeys.leaderboard(roomId ?? ''),
        queryFn: () => getRoomLeaderboard(roomId ?? ''),
        enabled: !!roomId && enabled,
    })
}

export const useRoomWeeklyLeaderboard = (roomId?: string, enabled = true) => {
    return useQuery({
        queryKey: roomKeys.weeklyLeaderboard(roomId ?? ''),
        queryFn: () => getRoomWeeklyLeaderboard(roomId ?? ''),
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
