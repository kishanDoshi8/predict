function Dot({
	className,
	color,
	animate,
}: {
	className?: string;
	color?: string;
	animate?: boolean;
}) {
	return (
		<div
			className={`rounded-full ${className} ${color ? `bg-${color}` : "bg-muted-foreground"} ${animate ? "animate-pulse" : ""}`}
		/>
	);
}

export default Dot;
