import { useEffect, useState } from "react";
import { usePredictionHistory, useSeriesLeaderboard } from "@/features/leaderboard";
import { useRoomActivities } from "@/features/activities";
import { useCurrentSeries } from "@/features/series";

// Loads the other tabs' first screen in the background, shortly after the
// room opens, so switching tabs shows data straight away. It uses the same
// hooks (and so the same cache entries) as those pages, and renders nothing.
export function RoomPrefetcher({ roomId }: Readonly<{ roomId: string }>) {
	const [ready, setReady] = useState(false);
	const { currentSeriesId } = useCurrentSeries(roomId);
	const seriesId = currentSeriesId ?? undefined;

	useEffect(() => {
		const id = globalThis.setTimeout(() => setReady(true), 800);
		return () => globalThis.clearTimeout(id);
	}, []);

	useSeriesLeaderboard(roomId, currentSeriesId, ready);
	usePredictionHistory(ready ? roomId : undefined, "all", "", seriesId);
	useRoomActivities(ready ? roomId : undefined, "all", seriesId);

	return null;
}
