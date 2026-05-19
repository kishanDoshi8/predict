const optionColors = [
  "text-purple-500",
  "text-cyan-500",
  "text-red-500",
  "text-green-500",
  "text-yellow-500",
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

export function useOptionBgColor(optionId: string) {
  const color = useOptionColor(optionId)
  
  const bgColor = color.replace("text-", "bg-").replace("-500", "-100")
  console.log(bgColor);
  return bgColor
}