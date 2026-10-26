import { cn, twColor } from "@/shared/lib/utils";

// A placeholder in the shape of what's loading. A soft shimmer sweeps across
// it; with reduced motion it stays still.
function Skeleton({ className, style, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot='skeleton'
			className={cn(
				"animate-shimmer rounded-lg bg-muted-foreground/20 motion-reduce:animate-none",
				className,
			)}
			style={{
				backgroundImage: `linear-gradient(90deg, transparent 0%, ${twColor("foreground", 0.09)} 50%, transparent 100%)`,
				backgroundSize: "200% 100%",
				backgroundRepeat: "no-repeat",
				...style,
			}}
			{...props}
		/>
	);
}

export { Skeleton };
