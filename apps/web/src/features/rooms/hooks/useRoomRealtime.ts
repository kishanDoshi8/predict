import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { roomKeys } from "@/shared/constants/queryKeys";
import { playerQueryKey } from "@/features/home";

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
				},
			)
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
				},
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "room_stats",
					filter: `room_id=eq.${roomId}`,
				},
				() => {
					queryClient.invalidateQueries({
						queryKey: roomKeys.stats(roomId),
					});
				},
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "player_room_stats",
					filter: `room_id=eq.${roomId}`,
				},
				() => {
					queryClient.invalidateQueries({
						queryKey: roomKeys.stats(roomId),
					});
				},
			)
			.subscribe((status) => {
				console.log("Realtime status:", status);
			});

		return () => {
			supabase.removeChannel(channel);
		};
	}, [roomId, queryClient]);
}

export function useRoomBetRealtime(
	roomId: string,
	predictionId: string | null,
) {
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
				},
			)
			.subscribe((status) => {
				console.log("Realtime bet status:", status);
			});

		return () => {
			supabase.removeChannel(channel);
		};
	}, [roomId, predictionId, queryClient]);
}

export function usePredictionDuelRealtime(
	roomId: string,
	predictionId: string | null,
) {
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!predictionId) return;

		const client = supabase as unknown as {
			channel: (name: string) => any;
			removeChannel: (channel: unknown) => void;
		};

		const channel = client
			.channel(`duels:${predictionId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "duels",
					filter: `prediction_id=eq.${predictionId}`,
				},
				() => {
					queryClient.invalidateQueries({
						queryKey: roomKeys.duels(roomId, predictionId),
					});
					queryClient.invalidateQueries({
						queryKey: roomKeys.duelSummary(roomId, predictionId),
					});
					queryClient.invalidateQueries({
						queryKey: playerQueryKey,
					});
				},
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "duel_queue",
				},
				() => {
					queryClient.invalidateQueries({
						queryKey: roomKeys.duels(roomId, predictionId),
					});
					queryClient.invalidateQueries({
						queryKey: roomKeys.duelSummary(roomId, predictionId),
					});
				},
			)
			.subscribe((status: string) => {
				console.log("Realtime duel status:", status);
			});

		return () => {
			client.removeChannel(channel);
		};
	}, [predictionId, queryClient, roomId]);
}
