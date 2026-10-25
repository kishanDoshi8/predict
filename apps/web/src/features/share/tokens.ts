// Shareables look like the app's own screens ("straight from the app"). They're
// captured to PNG, so they use the app's dark theme as fixed inline values and
// look the same whatever theme the person sharing uses.
export const app = {
	base: "#09090b",
	card: "#18181b",
	raised: "#27272a",
	hairline: "rgba(255, 255, 255, 0.1)",
	text: "#fafafa",
	muted: "#a1a1aa",
	faint: "#71717a",
	rose: "#f43f5e",
	orange: "#fb923c",
	gradient: "linear-gradient(90deg, #f43f5e, #fb923c)",
	win: "#4ade80",
	loss: "#fb7185",
	gold: "#facc15",
	silver: "#a1a1aa",
	bronze: "#fb923c",
	cyan: "#22d3ee",
	font: '"Fira Code Variable", ui-monospace, monospace',
} as const;

export type CardFormat = "post" | "story";

export const CARD_SIZE: Record<CardFormat, { width: number; height: number }> = {
	post: { width: 1080, height: 1350 },
	story: { width: 1080, height: 1920 },
};
