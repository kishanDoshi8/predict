import {
	getSeriesSuggestions,
	markSeriesSuggestionPlayed,
	removeSeriesSuggestion,
	suggestSeries,
	toggleSeriesSuggestionVote,
	type SeriesSuggestion,
} from "@/shared/lib/api";
import { roomKeys } from "@/shared/constants/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// The room's "Up next" board: ideas for the next series, most backed first.
export const useSeriesSuggestions = (roomId?: string) => {
	return useQuery({
		queryKey: roomKeys.seriesSuggestions(roomId ?? ""),
		queryFn: () => getSeriesSuggestions(roomId ?? ""),
		enabled: !!roomId,
	});
};

const useInvalidateSuggestions = (roomId?: string) => {
	const queryClient = useQueryClient();
	return () =>
		queryClient.invalidateQueries({
			queryKey: roomKeys.seriesSuggestions(roomId ?? ""),
		});
};

export const useSuggestSeries = (roomId?: string) => {
	const invalidate = useInvalidateSuggestions(roomId);
	return useMutation({
		mutationFn: (title: string) => suggestSeries(roomId ?? "", title),
		onSettled: invalidate,
	});
};

// Flips the vote straight away; the server's count follows.
export const useToggleSuggestionVote = (roomId?: string) => {
	const queryClient = useQueryClient();
	const queryKey = roomKeys.seriesSuggestions(roomId ?? "");

	return useMutation({
		mutationFn: (suggestionId: string) => toggleSeriesSuggestionVote(suggestionId),
		onMutate: async (suggestionId) => {
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData<SeriesSuggestion[]>(queryKey);
			queryClient.setQueryData<SeriesSuggestion[]>(queryKey, (rows) =>
				rows?.map((row) =>
					row.id === suggestionId
						? {
								...row,
								voted_by_me: !row.voted_by_me,
								vote_count: row.vote_count + (row.voted_by_me ? -1 : 1),
							}
						: row,
				),
			);
			return { previous };
		},
		onError: (_error, _id, context) => {
			if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
		},
		onSettled: () => queryClient.invalidateQueries({ queryKey }),
	});
};

export const useRemoveSuggestion = (roomId?: string) => {
	const invalidate = useInvalidateSuggestions(roomId);
	return useMutation({
		mutationFn: (suggestionId: string) => removeSeriesSuggestion(suggestionId),
		onSettled: invalidate,
	});
};

export const useMarkSuggestionPlayed = (roomId?: string) => {
	const invalidate = useInvalidateSuggestions(roomId);
	return useMutation({
		mutationFn: ({ suggestionId, seriesId }: { suggestionId: string; seriesId: string }) =>
			markSeriesSuggestionPlayed(suggestionId, seriesId),
		onSettled: invalidate,
	});
};
