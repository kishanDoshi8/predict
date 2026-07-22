export const SERIES_AWARD_META = {
	LONGEST_STREAK: { label: "Longest Win Streak" },
	BIGGEST_PROFIT: { label: "Biggest Profit" },
	MOST_DUEL_WINS: { label: "Duelist" },
	MOST_POINTS_RISKED: { label: "High Roller" },
	EVER_PRESENT: { label: "Ever-Present" },
} as const;

export type SeriesAwardType = keyof typeof SERIES_AWARD_META;

export function getSeriesAwardLabel(awardType: string) {
	if (awardType in SERIES_AWARD_META) {
		return SERIES_AWARD_META[awardType as SeriesAwardType].label;
	}

	return awardType;
}

export function getSeriesPlacementLabel(placement: number) {
	if (placement === 1) return "Champion";
	if (placement === 2) return "Runner-up";
	if (placement === 3) return "Third Place";
	return `#${placement}`;
}
