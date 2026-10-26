import type { Transition, Variants } from "framer-motion";

// Shared motion presets so content loads in the same way everywhere.
// Keep entrances short: content should feel like it was already there.

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const revealTransition: Transition = { duration: 0.28, ease: EASE_OUT };

export const collapseTransition: Transition = {
	duration: 0.24,
	ease: EASE_OUT,
};

export const progressTransition: Transition = {
	duration: 0.6,
	ease: EASE_OUT,
};

const STAGGER_STEP = 0.04;
// Rows past this index enter together, so long lists don't drag in.
const STAGGER_MAX_STEPS = 6;

export function staggerDelay(index: number, step = STAGGER_STEP) {
	return Math.min(Math.max(index, 0), STAGGER_MAX_STEPS) * step;
}

export type RevealCustom = {
	/** Position in a list; staggers items in. */
	index?: number;
	/** Extra wait in seconds, to sequence sections of one view. */
	delay?: number;
};

// Fade and lift in. `custom` places the item in its list and sequence.
export const revealVariants: Variants = {
	hidden: { opacity: 0, y: 6 },
	visible: ({ index = 0, delay = 0 }: RevealCustom = {}) => ({
		opacity: 1,
		y: 0,
		transition: { ...revealTransition, delay: delay + staggerDelay(index) },
	}),
};
