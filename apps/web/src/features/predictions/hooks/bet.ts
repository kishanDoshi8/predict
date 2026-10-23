import { cancelBet, getBetsForPrediction, getMyBet, placeBet, type SeriesWallet } from "@/shared/lib/api";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roomKeys } from "@/shared/constants/queryKeys";
import { Bet } from "@/features/predictions";

// Moves points into or out of escrow in the cached series wallet, so the
// available balance updates before the server answers.
function adjustCachedWalletEscrow(
    queryClient: QueryClient,
    roomId: string,
    seriesId: string | null,
    escrowDelta: number,
) {
    queryClient.setQueryData<SeriesWallet[]>(roomKeys.seriesWallets(roomId), (old) =>
        old?.map((wallet) =>
            wallet.series_id === seriesId
                ? {
                    ...wallet,
                    escrow: wallet.escrow + escrowDelta,
                    available: wallet.available - escrowDelta,
                }
                : wallet
        )
    );
}

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
    seriesId: string | null;
    optionId: string;
    amount: number;
}

export const usePlaceBet = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: PlaceBetParams) =>
        placeBet(data.predictionId, data.optionId, data.amount),

        onMutate: async (variables) => {
        const walletsKey = roomKeys.seriesWallets(variables.roomId);
        await queryClient.cancelQueries({ queryKey: walletsKey });

        const previousWallets = queryClient.getQueryData<SeriesWallet[]>(walletsKey);
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

        adjustCachedWalletEscrow(queryClient, variables.roomId, variables.seriesId, escrowDelta);

        return { previousWallets, previousBet };
        },

        onError: (_err, variables, context) => {
        // rollback
        if (context?.previousWallets) {
            queryClient.setQueryData(roomKeys.seriesWallets(variables.roomId), context.previousWallets);
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
            queryKey: roomKeys.seriesWallets(variables.roomId),
        });
        },
    });
};

type CancelBetParams = {
    roomId: string;
    playerId: string;
    predictionId: string;
    seriesId: string | null;
}

export const useCancelBet = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ predictionId }: CancelBetParams) =>
        cancelBet(predictionId),

        onMutate: async (variables) => {
        const walletsKey = roomKeys.seriesWallets(variables.roomId);
        await queryClient.cancelQueries({ queryKey: walletsKey });

        const betKey = roomKeys.myBet(
            variables.roomId,
            variables.predictionId,
            variables.playerId
        );

        const previousBet = queryClient.getQueryData<Bet>(betKey);
        const previousWallets = queryClient.getQueryData<SeriesWallet[]>(walletsKey);

        const oldAmount = previousBet?.amount ?? 0;

        // remove bet
        queryClient.setQueryData(betKey, null);

        // remove from bets list
        queryClient.setQueryData<Bet[]>(
            roomKeys.bets(variables.roomId, variables.predictionId),
            (old) => old?.filter((b) => b.player_id !== variables.playerId) ?? []
        );

        // release escrow
        adjustCachedWalletEscrow(queryClient, variables.roomId, variables.seriesId, -oldAmount);

        return { previousBet, previousWallets };
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

        if (context.previousWallets) {
            queryClient.setQueryData(roomKeys.seriesWallets(variables.roomId), context.previousWallets);
        }
        },

        onSettled: (_data, _err, variables) => {
        queryClient.invalidateQueries({
            queryKey: roomKeys.bets(variables.roomId, variables.predictionId),
        });

        queryClient.invalidateQueries({
            queryKey: roomKeys.seriesWallets(variables.roomId),
        });
        },
    });
};