import type { LeaderboardEntry } from "@/features/leaderboard/types/types";

export type RankedEntry = LeaderboardEntry & { rank: number };

// Players short of the series' minimum bets aren't ranked; they're listed apart.
export function splitStandings(entries: LeaderboardEntry[]) {
	const ranked: RankedEntry[] = [];
	const unranked: LeaderboardEntry[] = [];
	for (const entry of entries) {
		if (entry.is_ranked && entry.rank !== null) ranked.push({ ...entry, rank: entry.rank });
		else unranked.push(entry);
	}
	return { ranked, unranked };
}

// "needs 1 more bet", "needs 2 more bets".
export function betsNeededLabel(betsNeeded: number) {
	return `needs ${betsNeeded} more ${betsNeeded === 1 ? "bet" : "bets"}`;
}

// "Bet on 3 settled predictions to be ranked."
export function rankingRuleLabel(requiredBets: number) {
	return `Bet on ${requiredBets} settled ${requiredBets === 1 ? "prediction" : "predictions"} to be ranked.`;
}
