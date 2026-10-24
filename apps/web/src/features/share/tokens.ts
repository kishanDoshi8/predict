// "Receipts": every shareable is printed proof of something that happened.
// Cards are captured to PNG, so they use inline styles with these values
// rather than theme classes, and look the same in light and dark mode.
import "@fontsource-variable/big-shoulders-display";

export const receipt = {
	ink: "#09090b", // the app's own background, the surface the slip lies on
	paper: "#E9EBE6", // cool thermal paper, deliberately not cream
	print: "#17181A",
	faded: "#5F625E", // secondary print, like a fading thermal line
	brand: "#F0386B",
	amber: "#F5A524",
	win: "#2E9E45",
	loss: "#D93A3F",
	mono: '"Fira Code Variable", ui-monospace, monospace',
	display: '"Big Shoulders Display Variable", "Fira Code Variable", sans-serif',
} as const;

export type CardFormat = "post" | "story";

export const CARD_SIZE: Record<CardFormat, { width: number; height: number }> = {
	post: { width: 1080, height: 1350 },
	story: { width: 1080, height: 1920 },
};
