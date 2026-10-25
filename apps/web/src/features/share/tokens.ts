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

// "chat" images are as tall as their content, so nothing is ever cut off;
// "story" keeps the 9:16 frame stories need and shrinks content to fit it.
export type CardFormat = "chat" | "story";

export const CARD_SIZE: Record<CardFormat, { width: number; height?: number }> = {
	chat: { width: 1080 },
	story: { width: 1080, height: 1920 },
};

// Space a story keeps clear at the top and bottom for the app's own controls.
export const STORY_PADDING = { top: 180, bottom: 200, side: 72 } as const;
