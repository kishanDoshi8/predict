import { cn } from "@/shared/lib/utils";

type RankChangeProps = {
	// Places moved since Monday: positive is up. Null when there's nothing to
	// compare (first week of a series, or not ranked).
	change: number | null | undefined;
	// Ranked now but not on Monday.
	isNew?: boolean;
	className?: string;
};

// ▲2 / ▼3 / – / NEW next to a rank. Arrows and words carry the meaning, so
// it reads the same without colour.
export function RankChange({ change, isNew = false, className }: Readonly<RankChangeProps>) {
	if (isNew) {
		return (
			<span
				className={cn(
					"rounded-sm bg-primary/15 px-1 text-[10px] font-semibold leading-4 text-primary",
					className,
				)}
			>
				NEW
				<span className='sr-only'> in the standings since Monday</span>
			</span>
		);
	}

	if (change === null || change === undefined) {
		return null;
	}

	if (change === 0) {
		return (
			<span className={cn("text-xs text-muted-foreground", className)}>
				<span aria-hidden='true'>–</span>
				<span className='sr-only'>No change since Monday</span>
			</span>
		);
	}

	const up = change > 0;
	const places = Math.abs(change);
	return (
		<span
			className={cn(
				"text-xs font-semibold tabular-nums",
				up ? "text-win" : "text-loss",
				className,
			)}
		>
			<span aria-hidden='true'>
				{up ? "▲" : "▼"}
				{places}
			</span>
			<span className='sr-only'>
				{up ? "Up" : "Down"} {places} {places === 1 ? "place" : "places"} since
				Monday
			</span>
		</span>
	);
}
