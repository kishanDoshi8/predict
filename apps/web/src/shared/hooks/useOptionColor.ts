const optionColors = [
  "text-purple-500",
  "text-cyan-500",
  "text-red-500",
  "text-green-500",
  "text-yellow-500",
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

export function useOptionBgColor(optionId: string) {
  const color = getOptionColor(optionId)
  
  const bgColor = color.replace("text-", "bg-").replace("-500", "-100")
  return bgColor
}