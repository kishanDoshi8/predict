import { createPrediction, getActivePrediction, resolvePrediction } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roomKeys } from "./_keys";

export const useActivePrediction = (roomId?: string) => {
    return useQuery({
        queryKey: roomKeys.activePrediction(roomId ?? ""),
        queryFn: () => getActivePrediction(roomId ?? ""),
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
}

export const useResolvePrediction = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: ResolvePredictionParams) =>
            resolvePrediction(data.predictionId, data.roomId, data.outcome, data.winningOptionId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: roomKeys.activePrediction(variables.roomId),
            });
        },
        onError: (error) => {
            console.error("Error resolving prediction:", error);
        },
    });
}