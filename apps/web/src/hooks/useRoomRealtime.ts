import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { roomKeys } from "@/store/_keys";

export function useRoomRealtime(roomId: string | null) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!roomId) return;

        const channel = supabase
        .channel(`room:${roomId}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "room_members",
                filter: `room_id=eq.${roomId}`,
            },
            () => {
                queryClient.invalidateQueries({
                    queryKey: roomKeys.detail(roomId),
                });
            }
        )
        // Invalidate activePredictions whenever any prediction in this room changes
        // (created, locked, resolved, cancelled). This keeps the dashboard carousel
        // in sync without a page refresh.
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "predictions",
                filter: `room_id=eq.${roomId}`,
            },
            () => {
                queryClient.invalidateQueries({
                    queryKey: roomKeys.activePredictions(roomId),
                });
            }
        )
        .subscribe((status) => {
            console.log("Realtime status:", status);
        });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, queryClient]);
}

export function useRoomBetRealtime(roomId: string, predictionId: string | null) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!predictionId) return;

        const channel = supabase
        .channel(`prediction:${predictionId}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "bets",
                filter: `prediction_id=eq.${predictionId}`,
            },
            () => {
                queryClient.invalidateQueries({
                    queryKey: roomKeys.prediction(roomId, predictionId),
                });
            }
        )
        .subscribe((status) => {
            console.log("Realtime bet status:", status);
        });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, predictionId, queryClient]);
}

