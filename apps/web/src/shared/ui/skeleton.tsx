import { cn } from "@/shared/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot='skeleton'
			className={cn(
				"animate-pulse rounded-md bg-muted-foreground/35",
				className,
			)}
			{...props}
		/>
	);
}

export { Skeleton };
