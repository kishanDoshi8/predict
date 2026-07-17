import {
	activateSeries,
	archiveSeries,
	completeSeries,
	createSeries,
	getRoomSeries,
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
