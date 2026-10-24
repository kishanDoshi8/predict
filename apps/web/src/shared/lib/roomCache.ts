import type { QueryClient } from "@tanstack/react-query";
import { roomKeys } from "@/shared/constants/queryKeys";

// A result moves points, so every view built on wallets has to refetch:
// balances, standings, history and the in-play list.
export function invalidateRoomResults(queryClient: QueryClient, roomId: string) {
	queryClient.invalidateQueries({ queryKey: roomKeys.activePrediction(roomId) });
	queryClient.invalidateQueries({ queryKey: roomKeys.activePredictions(roomId) });
	queryClient.invalidateQueries({ queryKey: roomKeys.seriesWallets(roomId) });
	queryClient.invalidateQueries({ queryKey: roomKeys.stats(roomId) });
	queryClient.invalidateQueries({ queryKey: ["prediction-history", roomId] });
	queryClient.invalidateQueries({
		predicate: (query) =>
			query.queryKey[0] === roomKeys.all[0] &&
			query.queryKey[1] === roomId &&
			(query.queryKey[2] === "seriesLeaderboard" ||
				query.queryKey[2] === "overallStandings"),
	});
}
