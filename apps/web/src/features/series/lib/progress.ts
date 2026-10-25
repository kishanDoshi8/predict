import type { Series } from "@/features/series/types/series";

type SeriesProgressSource = Pick<
	Series,
	"expectedGames" | "completedGames" | "activePredictions"
>;

export type SeriesProgress = {
	// No set number of games: the series runs until the organizer closes it.
	isOpenEnded: boolean;
	expected: number;
	resolved: number;
	open: number;
	remaining: number;
	percent: number;
};

// expectedGames = 0 means open-ended.
export function getSeriesProgress(
	series: SeriesProgressSource,
): SeriesProgress {
	const expected = Math.max(series.expectedGames, 0);
	const resolved = Math.max(series.completedGames, 0);
	const open = Math.max(series.activePredictions, 0);
	const isOpenEnded = expected === 0;

	return {
		isOpenEnded,
		expected,
		resolved,
		open,
		remaining: Math.max(expected - resolved, 0),
		percent: isOpenEnded
			? 0
			: Math.floor(Math.min((resolved / expected) * 100, 100)),
	};
}
