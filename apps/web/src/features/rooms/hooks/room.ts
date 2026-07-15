import { createRoom, getPlayerRooms, getRoomStatCards, joinRoom, markRoomActivitiesSeen, spectateRoom } from "@/shared/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roomKeys } from "@/shared/constants/queryKeys";
import { playerQueryKey } from "@/features/home";

export const useRoom = (roomCode?: string) => {
    return useQuery({
        queryKey: roomKeys.byCode(roomCode ?? ""),
        queryFn: () => spectateRoom(roomCode ?? ""),
        enabled: !!roomCode,
        refetchInterval: 5 * 60 * 1000, // Refetch room data every 5 minutes
    });
}

type CreateRoomParams = {
    roomName: string;
}

export const useCreateRoom = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ roomName }: CreateRoomParams) => createRoom(roomName),
        onSuccess: (data) => {
            queryClient.setQueryData(roomKeys.byCode(data.code), data);
        },
    });
}

export const useJoinRoom = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ roomCode }: { roomCode: string }) => joinRoom(roomCode),
        onSuccess: (data) => {
            queryClient.setQueryData(roomKeys.byCode(data.code), data);
            void Promise.all([
                queryClient.invalidateQueries({
                    predicate: (query) => query.queryKey[0] === roomKeys.all[0],
                }),
                queryClient.invalidateQueries({ queryKey: playerQueryKey }),
            ]);
        },
    });
}

export const usePlayerRooms = (player_id: string) => {
    return useQuery({
        queryKey: roomKeys.byPlayer(player_id),
        queryFn: () => getPlayerRooms(player_id),
        retry: false,
        enabled: !!player_id,
    });
}

export const useRoomStatCards = (roomId?: string, limit = 5) => {
    return useQuery({
        queryKey: roomKeys.stats(roomId ?? ""),
        queryFn: () => getRoomStatCards(roomId ?? "", limit),
        enabled: !!roomId,
    });
}

export const useMarkRoomActivitiesSeen = (roomCode?: string, roomId?: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => markRoomActivitiesSeen(roomId ?? ""),
        onSuccess: () => {
            if (roomCode) {
                void queryClient.invalidateQueries({
                    queryKey: roomKeys.byCode(roomCode),
                });
            }
        },
    });
}
