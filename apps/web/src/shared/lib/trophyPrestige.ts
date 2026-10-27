import type { SeriesAwardType } from "@/shared/lib/seriesRewards";

// How much a series' trophies are worth, from how big the series was.
// Tune the thresholds here; everything else reads them through these helpers.
export type SeriesTier = "major" | "standard" | "minor";

const MAJOR_MIN_GAMES = 20;
const MAJOR_MIN_PLAYERS = 5;
const MINOR_MAX_GAMES = 7;
const MINOR_MAX_PLAYERS = 2;

const TIER_WEIGHT: Record<SeriesTier, number> = {
	major: 3,
	standard: 2,
	minor: 1,
};

const PLACEMENT_WEIGHT: Record<number, number> = { 1: 10, 2: 6, 3: 4 };
const AWARD_WEIGHT = 3;

export const SERIES_TIER_ORDER: SeriesTier[] = ["major", "standard", "minor"];

export const SERIES_TIER_LABEL: Record<SeriesTier, string> = {
	major: "Major",
	standard: "Standard",
	minor: "Minor",
};

// Players is null until series store how many players qualified; the tier
// then comes from games alone.
export function getSeriesTier({
	games,
	players = null,
}: {
	games: number | null;
	players?: number | null;
}): SeriesTier {
	if (games === null) return "standard";
	if (games <= MINOR_MAX_GAMES) return "minor";
	if (players !== null && players <= MINOR_MAX_PLAYERS) return "minor";
	if (
		games >= MAJOR_MIN_GAMES &&
		(players === null || players >= MAJOR_MIN_PLAYERS)
	) {
		return "major";
	}
	return "standard";
}

export type Trophy = {
	id: string;
	seriesId: string;
	seriesTitle: string;
	tier: SeriesTier;
	score: number;
	// When the trophy was won, for recency tie-breaks and the cabinet.
	wonAt: string;
} & (
	| { kind: "placement"; placement: number }
	| { kind: "award"; awardType: SeriesAwardType; value: number }
);

type ChampionshipRow = {
	id: string;
	series_id: string;
	series_title: string;
	series_games: number | null;
	series_completed_at: string | null;
	placement: number;
	created_at: string;
};

type AwardRow = {
	id: string;
	series_id: string;
	series_title: string;
	series_games: number | null;
	series_completed_at: string | null;
	award_type: SeriesAwardType;
	value: number;
	created_at: string;
};

// Every trophy a player holds, most prestigious first.
export function buildTrophies(
	championships: ChampionshipRow[],
	awards: AwardRow[],
): Trophy[] {
	const trophies: Trophy[] = [
		...championships.map((row): Trophy => {
			const tier = getSeriesTier({ games: row.series_games });
			return {
				id: row.id,
				kind: "placement",
				placement: row.placement,
				seriesId: row.series_id,
				seriesTitle: row.series_title,
				tier,
				score: TIER_WEIGHT[tier] * (PLACEMENT_WEIGHT[row.placement] ?? 1),
				wonAt: row.series_completed_at ?? row.created_at,
			};
		}),
		...awards.map((row): Trophy => {
			const tier = getSeriesTier({ games: row.series_games });
			return {
				id: row.id,
				kind: "award",
				awardType: row.award_type,
				value: row.value,
				seriesId: row.series_id,
				seriesTitle: row.series_title,
				tier,
				score: TIER_WEIGHT[tier] * AWARD_WEIGHT,
				wonAt: row.series_completed_at ?? row.created_at,
			};
		}),
	];

	return trophies.sort(
		(a, b) => b.score - a.score || b.wonAt.localeCompare(a.wonAt),
	);
}

export type IdentityTitle = {
	label: string;
	tone: "champion" | "podium" | "contender" | "neutral";
};

const ROOKIE_MAX_PREDICTIONS = 10;
const PODIUM_REGULAR_MIN = 3;

// A one-glance read of who this player is in the room. First match wins.
export function getIdentityTitle({
	trophies,
	totalPredictions,
	latestCompletedSeriesId,
}: {
	trophies: Trophy[];
	totalPredictions: number;
	latestCompletedSeriesId: string | null;
}): IdentityTitle {
	const placements = trophies.filter((t) => t.kind === "placement");
	const titles = placements.filter((t) => t.placement === 1);

	if (
		latestCompletedSeriesId &&
		titles.some((t) => t.seriesId === latestCompletedSeriesId)
	) {
		return { label: "Reigning Champion", tone: "champion" };
	}
	if (titles.length >= 2) {
		return { label: `${titles.length}× Champion`, tone: "champion" };
	}
	if (titles.length === 1) return { label: "Champion", tone: "champion" };
	if (placements.length >= PODIUM_REGULAR_MIN) {
		return { label: "Podium Regular", tone: "podium" };
	}
	if (trophies.length > 0) return { label: "Contender", tone: "contender" };
	if (totalPredictions < ROOKIE_MAX_PREDICTIONS) {
		return { label: "Rookie", tone: "neutral" };
	}
	return { label: "Regular", tone: "neutral" };
}
