import { cn } from "@/shared/lib/utils";
import { Skeleton, SkeletonList } from "@/shared/ui";

type Props = {
	count?: number;
	/** "stake": name | amount over pick. "payout": name over stake | net result. */
	variant?: "stake" | "payout";
	/** "joined": rows in one bordered box. "separate": each row its own card. */
	layout?: "joined" | "separate";
};

// A text line's box at its real line height, with a shorter bar inside.
function Line({
	height,
	width,
	align = "start",
}: Readonly<{ height: "h-5" | "h-6" | "h-7"; width: string; align?: "start" | "end" }>) {
	return (
		<div
			className={cn(
				"flex items-center",
				height,
				align === "end" && "justify-end",
			)}
		>
			<Skeleton className={cn(height === "h-5" ? "h-3" : "h-4", width)} />
		</div>
	);
}

// Placeholder for the "Who bet what?" / "Payout" lists on a prediction, laid
// out like their rows so the list fills in place.
export function BetListSkeleton({
	count = 2,
	variant = "stake",
	layout = "joined",
}: Readonly<Props>) {
	const isPayout = variant === "payout";
	return (
		<SkeletonList
			count={count}
			className={
				layout === "joined"
					? "rounded-xl overflow-hidden border border-border"
					: undefined
			}
			renderItem={() => (
				<div
					className={cn(
						"flex justify-between p-4",
						layout === "joined"
							? "border-b border-secondary bg-card"
							: "mt-2 border border-secondary rounded-xl",
					)}
				>
					<div>
						<Line height={isPayout ? "h-7" : "h-6"} width='w-28' />
						{isPayout ? <Line height='h-5' width='w-32' /> : null}
					</div>
					<div>
						<Line
							height={isPayout ? "h-7" : "h-6"}
							width='w-16'
							align='end'
						/>
						{isPayout ? null : (
							<Line height='h-5' width='w-20' align='end' />
						)}
					</div>
				</div>
			)}
		/>
	);
}
