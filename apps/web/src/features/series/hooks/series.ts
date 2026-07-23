import {
	activateSeries,
	archiveSeries,
	collectSeriesRewards,
	completeSeries,
	createSeries,
	getSeriesAwards,
	getSeriesPlacements,
	getRoomSeries,
	getRoomSeriesSelector,
	type RoomSeriesSelector,
	type SeriesSelectorMode,
	updateSeries,
} from "@/shared/lib/api";
import { roomKeys } from "@/shared/constants/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type UpsertSeriesParams = {
	title: string;
	description: string;
	expectedGames: number;
};

export const useRoomSeries = (roomId?: string) => {
	return useQuery({
		queryKey: roomKeys.series(roomId ?? ""),
		queryFn: () => getRoomSeries(roomId ?? ""),
		enabled: !!roomId,
	});
};

export const useSeriesSelector = (
	roomId?: string,
	mode: SeriesSelectorMode = "active-or-last",
	selectedSeriesId?: string | null,
	enabled = true,
) => {
	return useQuery<RoomSeriesSelector>({
		queryKey: roomKeys.seriesSelector(
			roomId ?? "",
			mode,
			selectedSeriesId ?? "default",
		),
		queryFn: () => getRoomSeriesSelector(roomId ?? "", selectedSeriesId, mode),
		placeholderData: (previousData) => previousData,
		enabled: !!roomId && enabled,
	});
};

export const useCreateSeries = (roomId?: string) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: UpsertSeriesParams) =>
			createSeries(roomId ?? "", payload),
		onSuccess: () => {
			if (roomId) {
				void queryClient.invalidateQueries({
					queryKey: roomKeys.series(roomId),
				});
			}
		},
	});
};

export const useUpdateSeries = (roomId?: string) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: { seriesId: string } & UpsertSeriesParams) =>
			updateSeries(payload.seriesId, payload),
		onSuccess: () => {
			if (roomId) {
				void queryClient.invalidateQueries({
					queryKey: roomKeys.series(roomId),
				});
			}
		},
	});
};

export const useActivateSeries = (roomId?: string) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (seriesId: string) => activateSeries(seriesId),
		onSuccess: () => {
			if (roomId) {
				void queryClient.invalidateQueries({
					queryKey: roomKeys.series(roomId),
				});
			}
		},
	});
};

export const useCompleteSeries = (roomId?: string) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (seriesId: string) => completeSeries(seriesId),
		onSuccess: () => {
			if (roomId) {
				void queryClient.invalidateQueries({
					queryKey: roomKeys.series(roomId),
				});
			}
		},
	});
};

export const useArchiveSeries = (roomId?: string) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (seriesId: string) => archiveSeries(seriesId),
		onSuccess: () => {
			if (roomId) {
				void queryClient.invalidateQueries({
					queryKey: roomKeys.series(roomId),
				});
			}
		},
	});
};

export const useSeriesPlacements = (
	roomId?: string,
	seriesId?: string | null,
	enabled = true,
) => {
	return useQuery({
		queryKey: roomKeys.seriesPlacements(roomId ?? "", seriesId ?? ""),
		queryFn: () => getSeriesPlacements(roomId ?? "", seriesId ?? ""),
		enabled: !!roomId && !!seriesId && enabled,
	});
};

export const useSeriesAwards = (
	roomId?: string,
	seriesId?: string | null,
	enabled = true,
) => {
	return useQuery({
		queryKey: roomKeys.seriesAwards(roomId ?? "", seriesId ?? ""),
		queryFn: () => getSeriesAwards(roomId ?? "", seriesId ?? ""),
		enabled: !!roomId && !!seriesId && enabled,
	});
};

export const useCollectSeriesRewards = (
	roomId?: string,
	seriesId?: string | null,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => collectSeriesRewards(seriesId ?? ""),
		onSuccess: () => {
			if (roomId && seriesId) {
				void Promise.all([
					queryClient.invalidateQueries({
						queryKey: roomKeys.seriesPlacements(roomId, seriesId),
					}),
					queryClient.invalidateQueries({
						queryKey: roomKeys.seriesAwards(roomId, seriesId),
					}),
				]);
			}
		},
	});
};
