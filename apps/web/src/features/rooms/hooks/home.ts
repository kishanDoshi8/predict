import {
	dismissWeeklyRecap,
	getMyUnseenResults,
	getMyWeeklyRecap,
	markResultsSeen,
	type UnseenResult,
} from "@/shared/lib/api";
import { roomKeys } from "@/shared/constants/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// How the player's recent bets in a series turned out, not yet dismissed.
export const useUnseenResults = (roomId?: string, seriesId?: string | null) =>
	useQuery({
		queryKey: roomKeys.unseenResults(roomId ?? "", seriesId ?? ""),
		queryFn: () => getMyUnseenResults(roomId ?? "", seriesId ?? ""),
		enabled: !!roomId && !!seriesId,
	});

// Dismisses results; they leave the card straight away and the next ones move up.
export const useMarkResultsSeen = (roomId?: string, seriesId?: string | null) => {
	const queryClient = useQueryClient();
	const queryKey = roomKeys.unseenResults(roomId ?? "", seriesId ?? "");

	return useMutation({
		mutationFn: (predictionIds: string[]) => markResultsSeen(predictionIds),
		onMutate: async (predictionIds) => {
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData<UnseenResult[]>(queryKey);
			queryClient.setQueryData<UnseenResult[]>(queryKey, (rows) =>
				rows?.filter((row) => !predictionIds.includes(row.prediction_id)),
			);
			return { previous };
		},
		onError: (_error, _ids, context) => {
			if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
		},
	});
};

// The player's last week in a series; null when there's nothing to say.
export const useMyWeeklyRecap = (roomId?: string, seriesId?: string | null) =>
	useQuery({
		queryKey: roomKeys.myWeeklyRecap(roomId ?? "", seriesId ?? ""),
		queryFn: () => getMyWeeklyRecap(roomId ?? "", seriesId ?? ""),
		enabled: !!roomId && !!seriesId,
	});

export const useDismissWeeklyRecap = (roomId?: string, seriesId?: string | null) => {
	const queryClient = useQueryClient();
	const queryKey = roomKeys.myWeeklyRecap(roomId ?? "", seriesId ?? "");

	return useMutation({
		mutationFn: (weekKey: string) => dismissWeeklyRecap(seriesId ?? "", weekKey),
		onMutate: async () => {
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData(queryKey);
			queryClient.setQueryData(queryKey, null);
			return { previous };
		},
		onError: (_error, _week, context) => {
			if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
		},
	});
};
