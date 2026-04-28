import { claimWeeklyPoints } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ============================================================
// useWeeklyClaim
// On mount: checks if the player has claimed this week.
// If auto-claim is enabled: silently claims and shows a toast.
// If not: shows the claim banner.
//
// ============================================================

export function useWeeklyClaim(playerToken: string | null) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => claimWeeklyPoints(playerToken ?? ""),
        onSuccess(data) {
            queryClient.setQueryData(["weeklyClaim"], {...data, lastClaimed: new Date()});
            if (!data.already_claimed) {
                toast(`Weekly reward auto-claimed! +${data.points_added} • Streak ${data.current_streak} 🔥`, {
                    duration: 7000,
                    position: "top-center"
                });
            }
            queryClient.invalidateQueries({ queryKey: ["player"] });
        },
    })
}