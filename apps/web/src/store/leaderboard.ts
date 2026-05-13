import { getRoomLeaderboard, getRoomPredictionHistory } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { roomKeys } from './_keys'

export const useRoomLeaderboard = (roomId?: string) => {
    return useQuery({
        queryKey: roomKeys.leaderboard(roomId ?? ''),
        queryFn: () => getRoomLeaderboard(roomId ?? ''),
        enabled: !!roomId,
    })
}

export const usePredictionHistory = (roomId?: string) => {
    return useQuery({
        queryKey: roomKeys.predictionHistory(roomId ?? ''),
        queryFn: () => getRoomPredictionHistory(roomId ?? ''),
        enabled: !!roomId,
    })
}
