const optionColors = [
  "text-cyan-500",
  "text-yellow-500",
  "text-green-500",
  "text-red-500",
  "text-purple-500",
]

const optionColorMap: Record<string, string> = {}

export function useOptionColor(optionId: string) {
  if (optionColorMap[optionId]) {
    return optionColorMap[optionId]
  }
  const color = optionColors[Object.keys(optionColorMap).length % optionColors.length]
  optionColorMap[optionId] = color
  return color
} 