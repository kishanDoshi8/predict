// Career milestones: personal bars a player clears once per room, kept apart
// from series awards (see private.award_milestones).
export const MILESTONE_META = {
	FIRST_TITLE: {
		label: "First Title",
		description: "Won a series for the first time.",
	},
	HAT_TRICK: { label: "Hat-trick", description: "Won three series." },
	BACK_TO_BACK: {
		label: "Back-to-Back",
		description: "Won two series in a row.",
	},
	CENTURY: { label: "Century", description: "Made 100 predictions." },
	MOONSHOT: {
		label: "Moonshot",
		description: "Won at odds of 10× or more.",
	},
	IRON_SEASON: {
		label: "Iron Season",
		description: "Bet on every game of a 10+ game series.",
	},
} as const;

export type MilestoneType = keyof typeof MILESTONE_META;

export function isMilestoneType(value: string): value is MilestoneType {
	return value in MILESTONE_META;
}
