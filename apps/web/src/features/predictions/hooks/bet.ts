import { cancelBet, getBetsForPrediction, getMyBet, placeBet } from "@/shared/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roomKeys } from "@/shared/constants/queryKeys";
import { Player } from "@/features/home";
import { Bet } from "@/features/predictions";
import { playerQueryKey } from "@/features/home";

export const useMyBet = (roomId: string, predictionId: string, playerId: string) => {
    return useQuery({
        queryKey: roomKeys.myBet(roomId, predictionId, playerId),
        queryFn: () => getMyBet(predictionId, playerId),
        enabled: !!predictionId && !!playerId,
    });
}

export const useBets = (roomId: string, predictionId?: string) => {
    return useQuery({
        queryKey: roomKeys.bets(roomId, predictionId ?? ""),
        queryFn: () => getBetsForPrediction(predictionId ?? ""),
        enabled: !!predictionId,
    });
}

type PlaceBetParams = {
    roomId: string;
    playerId: string;
    predictionId: string;
    optionId: string;
    amount: number;
}

export const usePlaceBet = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: PlaceBetParams) =>
        placeBet(data.predictionId, data.optionId, data.amount),

        onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: playerQueryKey });

        const previousPlayer = queryClient.getQueryData<Player>(playerQueryKey);
        const previousBet = queryClient.getQueryData<Bet>(
            roomKeys.myBet(variables.roomId, variables.predictionId, variables.playerId)
        );

        const oldAmount = previousBet?.amount ?? 0;
        const escrowDelta = variables.amount - oldAmount;

        // update bet cache
        queryClient.setQueryData(
            roomKeys.myBet(variables.roomId, variables.predictionId, variables.playerId),
            {
            prediction_id: variables.predictionId,
            option_id: variables.optionId,
            amount: variables.amount,
            }
        );

        // update player escrow
        queryClient.setQueryData<Player>(playerQueryKey, (old) =>
            old
            ? {
                ...old,
                points_in_escrow: old.points_in_escrow + escrowDelta,
                }
            : old
        );

        return { previousPlayer, previousBet };
        },

        onError: (_err, variables, context) => {
        // rollback
        if (context?.previousPlayer) {
            queryClient.setQueryData(playerQueryKey, context.previousPlayer);
        }
        if (context?.previousBet) {
            queryClient.setQueryData(
            roomKeys.myBet(variables.roomId, variables.predictionId, variables.playerId),
            context.previousBet
            );
        }
        },

        onSettled: (_data, _err, variables) => {
        queryClient.invalidateQueries({
            queryKey: roomKeys.bets(variables.roomId, variables.predictionId),
        });

        queryClient.invalidateQueries({
            queryKey: playerQueryKey,
        });
        },
    });
};

type CancelBetParams = {
    roomId: string;
    playerId: string;
    predictionId: string;
}

export const useCancelBet = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ predictionId }: CancelBetParams) =>
        cancelBet(predictionId),

        onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: playerQueryKey });

        const betKey = roomKeys.myBet(
            variables.roomId,
            variables.predictionId,
            variables.playerId
        );

        const previousBet = queryClient.getQueryData<Bet>(betKey);
        const previousPlayer = queryClient.getQueryData<Player>(playerQueryKey);

        const oldAmount = previousBet?.amount ?? 0;

        // remove bet
        queryClient.setQueryData(betKey, null);

        // remove from bets list
        queryClient.setQueryData<Bet[]>(
            roomKeys.bets(variables.roomId, variables.predictionId),
            (old) => old?.filter((b) => b.player_id !== variables.playerId) ?? []
        );

        // release escrow
        queryClient.setQueryData<Player>(playerQueryKey, (old) =>
            old
            ? {
                ...old,
                points_in_escrow: old.points_in_escrow - oldAmount,
                }
            : old
        );

        return { previousBet, previousPlayer };
        },

        onError: (_err, variables, context) => {
        if (!context) return;

        if (context.previousBet) {
            queryClient.setQueryData(
            roomKeys.myBet(
                variables.roomId,
                variables.predictionId,
                variables.playerId
            ),
            context.previousBet
            );
        }

        if (context.previousPlayer) {
            queryClient.setQueryData(playerQueryKey, context.previousPlayer);
        }
        },

        onSettled: (_data, _err, variables) => {
        queryClient.invalidateQueries({
            queryKey: roomKeys.bets(variables.roomId, variables.predictionId),
        });

        queryClient.invalidateQueries({
            queryKey: playerQueryKey,
        });
        },
    });
};