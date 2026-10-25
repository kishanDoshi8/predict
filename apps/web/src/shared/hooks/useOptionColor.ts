// Theme tokens (--option-1..5 in global.css). Complete class names, so Tailwind
// generates them; don't build these strings at runtime.
const optionColors = [
  "text-option-1",
  "text-option-2",
  "text-option-3",
  "text-option-4",
  "text-option-5",
]

const optionColorMap: Record<string, string> = {}

// A plain lookup (no React state), so it's safe to call inside loops.
export function getOptionColor(optionId: string) {
  if (optionColorMap[optionId]) {
    return optionColorMap[optionId]
  }
  const color = optionColors[Object.keys(optionColorMap).length % optionColors.length]
  optionColorMap[optionId] = color
  return color
}

export const useOptionColor = getOptionColor
