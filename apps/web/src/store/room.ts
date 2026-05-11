import { createRoom, getPlayerRooms, joinRoom, spectateRoom } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roomKeys } from "./_keys";

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