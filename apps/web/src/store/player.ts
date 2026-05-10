import { getPlayer, createPlayer } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { registerForPushNotifications } from "@/lib/pushNotifications";

export const playerQueryKey = ["player"];
export const playerToken = localStorage.getItem("predikt") ?? "";

export const setSession = (data: { player_token: string; player_id: string; username: string }) => {
    localStorage.setItem("predikt", data.player_token);
};

export const usePlayer = () => {
    return useQuery({
        queryKey: playerQueryKey,
        queryFn: () => getPlayer(playerToken),
        refetchInterval: 5 * 60 * 1000, // Refetch player data every 5 minutes
    });
}

export const useCreatePlayer = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (username: string) => createPlayer(username),
        onSuccess: async (data) => {
            console.log("Player created successfully:", data);
            setSession(data);
            await registerForPushNotifications(data.player_token);
            const player = await getPlayer(data.player_token);
            queryClient.setQueryData(playerQueryKey, player);
        },
        onError: (error) => {
            console.error("Error creating player:", error);
        },
    })
}
