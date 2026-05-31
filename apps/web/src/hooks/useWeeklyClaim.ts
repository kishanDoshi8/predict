import { claimWeeklyPoints } from "@/lib/api";
import { twColor } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ============================================================
// useWeeklyClaim
// On mount: checks if the player has claimed this week.
// If auto-claim is enabled: silently claims and shows a toast.
// If not: shows the claim banner.
//
// ============================================================

export function useWeeklyClaim() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => claimWeeklyPoints(),
        onSuccess(data) {
            queryClient.setQueryData(["weeklyClaim"], {...data, lastClaimed: new Date()});
            if (!data.already_claimed) {
                toast(`Weekly reward auto-claimed! +${data.points_added} • Streak ${data.current_streak} 🔥`, {
                    duration: Infinity,
                    dismissible: true,
                    position: "top-center",
                    style: {
                        background: twColor("card"),
                        color: twColor("card-foreground"),
                        border: `1px solid ${twColor("accent")}`,
                        boxShadow: `0 0 10px ${twColor("accent", 0.5)}`,
                        fontFamily: "monospace",
                    }
                });
            }
            queryClient.invalidateQueries({ queryKey: ["player"] });
        },
    })
}