import { getPlayer, createPlayer } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { registerForPushNotifications } from "@/lib/pushNotifications";

export const playerQueryKey = ["player"];

export const usePlayer = () => {
    return useQuery({
        queryKey: playerQueryKey,
        queryFn: () => getPlayer(),
        retry: false,
        refetchInterval: 5 * 60 * 1000, // Refetch player data every 5 minutes
    });
}

export const useCreatePlayer = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (username: string) => createPlayer(username),
        onSuccess: async (data) => {
            console.log("Player created successfully:", data);
            await registerForPushNotifications();
            const player = await getPlayer();
            queryClient.setQueryData(playerQueryKey, player);
        },
        onError: (error) => {
            console.error("Error creating player:", error);
        },
    })
}
