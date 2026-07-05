import { createPrediction, getActivePrediction, getActivePredictions, getPrediction, resolvePrediction } from "@/shared/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roomKeys } from "@/shared/constants/queryKeys";

export const useActivePrediction = (roomId?: string) => {
    return useQuery({
        queryKey: roomKeys.activePrediction(roomId ?? ""),
        queryFn: () => getActivePrediction(roomId ?? ""),
        enabled: !!roomId,
    });
}

// Returns all active (draft/locked) predictions for a room ordered by deadline asc.
// Falls back to the most recently completed prediction when no active ones exist.
export const useActivePredictions = (roomId?: string) => {
    return useQuery({
        queryKey: roomKeys.activePredictions(roomId ?? ""),
        queryFn: () => getActivePredictions(roomId ?? ""),
        enabled: !!roomId,
    });
}

type CreatePredictionParams = {
    roomId: string;
    title: string;
    options: string[];
    deadline: Date;
}

export const useCreatePrediction = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreatePredictionParams) => createPrediction(data.roomId, data.title, data.options, data.deadline),
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: roomKeys.activePrediction(data.room_id),
            });
            queryClient.invalidateQueries({
                queryKey: roomKeys.activePredictions(data.room_id),
            });
        },
        onError: (error) => {
            console.error("Error creating prediction:", error);
        },
    });            
}

type ResolvePredictionParams = {
    predictionId: string;
    outcome: 'win' | 'no_result' | 'cancel';
    winningOptionId?: string;
    roomId: string;
    noResultReason?: string | null;
}

export const useResolvePrediction = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: ResolvePredictionParams) =>
            resolvePrediction(data.predictionId, data.roomId, data.outcome, data.winningOptionId, data.noResultReason),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: roomKeys.activePrediction(variables.roomId),
            });
            queryClient.invalidateQueries({
                queryKey: roomKeys.activePredictions(variables.roomId),
            });
            queryClient.invalidateQueries({
                queryKey: roomKeys.stats(variables.roomId),
            });
        },
        onError: (error) => {
            console.error("Error resolving prediction:", error);
        },
    });
}

export const usePrediction = (roomId?: string, predictionId?: string) => {
    return useQuery({
        queryKey: roomKeys.prediction(roomId ?? "", predictionId ?? ""),
        queryFn: () => getPrediction(predictionId ?? ""),
        enabled: !!predictionId && !!roomId,
    });
}