import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/**
 * Dynamically retrieves a normal, resolved CSS color string from a Tailwind v4 variable.
 * @param colorName The name of the color (e.g., 'blue-500', 'primary')
 * @returns The computed CSS color value (guaranteed to be an rgb() or rgba() string)
 */
export function twColor(
	name: string,
	alpha?: number,
) {
	if (alpha !== undefined) {
		return `color-mix(in srgb, var(--${name}) ${
			alpha * 100
		}%, transparent)`;
	}

	return `var(--${name})`;
}
