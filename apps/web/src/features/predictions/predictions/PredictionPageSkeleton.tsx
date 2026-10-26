import { PredictionOptionsSkeleton } from "../widgets/PredictionOptions";
import { Skeleton } from "@/shared/ui";

// A prediction while it loads, whatever its status: a neutral card with
// status, title, the countdown or status slot, pool line and options, then
// the bets box. Avoids showing the open-for-picks card first.
export function PredictionPageSkeleton() {
	return (
		<div
			aria-busy='true'
			aria-label='Loading prediction'
			className={`flex-1 flex flex-col gap-4 items-center`}
		>
			<div
				className={`w-full max-w-md mx-auto flex flex-col items-center gap-4 rounded-xl border bg-card p-5`}
			>
				<Skeleton className={`h-5 w-24 rounded-full`} />
				<Skeleton className={`h-7 w-3/4`} />
				<div className={`flex flex-col items-center gap-1.5`}>
					<Skeleton className={`h-10 w-48`} />
					<Skeleton className={`h-4 w-32`} />
				</div>
				<Skeleton className={`h-5 w-36`} />
				<PredictionOptionsSkeleton />
			</div>
			<div
				className={`w-full max-w-md mx-auto rounded-xl border p-4 flex flex-col gap-3`}
			>
				<Skeleton className={`h-6 w-36`} />
				<Skeleton className={`h-14 w-full`} />
				<Skeleton className={`h-14 w-full`} />
			</div>
		</div>
	);
}
