import { Reveal, Skeleton } from "@/shared/ui";
import {
	getSeriesAwardLabel,
	type SeriesAwardType,
} from "@/shared/lib/seriesRewards";
import {
	getAwardVisual,
	getChampionshipVisual,
	getTierVisual,
	getTrophyVisual,
} from "@/shared/lib/seriesRecognitionVisuals";
import type { Trophy } from "@/shared/lib/trophyPrestige";
import { cn } from "@/shared/lib/utils";
import { ChevronRightIcon } from "lucide-react";

const FEATURED_COUNT = 3;

type Props = {
	trophies: Trophy[];
	isLoading: boolean;
	onViewAll: () => void;
};

type TallyItem = {
	key: string;
	count: number;
	label: string;
	visual: ReturnType<typeof getAwardVisual>;
};

const PLACEMENT_TALLY_LABEL: Record<number, [string, string]> = {
	1: ["title", "titles"],
	2: ["runner-up finish", "runner-up finishes"],
	3: ["third-place finish", "third-place finishes"],
};

// One chip per kind of trophy: titles, then podiums, then awards by count.
function buildTally(trophies: Trophy[]): TallyItem[] {
	const placements = new Map<number, number>();
	const awards = new Map<SeriesAwardType, number>();

	for (const trophy of trophies) {
		if (trophy.kind === "placement") {
			placements.set(
				trophy.placement,
				(placements.get(trophy.placement) ?? 0) + 1,
			);
		} else {
			awards.set(trophy.awardType, (awards.get(trophy.awardType) ?? 0) + 1);
		}
	}

	const placementItems = [...placements.entries()]
		.sort(([a], [b]) => a - b)
		.map(([placement, count]): TallyItem => {
			const [one, many] = PLACEMENT_TALLY_LABEL[placement] ?? [
				"podium",
				"podiums",
			];
			return {
				key: `placement-${placement}`,
				count,
				label: `${count} ${count === 1 ? one : many}`,
				visual: getChampionshipVisual(placement),
			};
		});

	const awardItems = [...awards.entries()]
		.sort(([, a], [, b]) => b - a)
		.map(
			([awardType, count]): TallyItem => ({
				key: `award-${awardType}`,
				count,
				label: `${count} × ${getSeriesAwardLabel(awardType)}`,
				visual: getAwardVisual(awardType),
			}),
		);

	return [...placementItems, ...awardItems];
}

function FeaturedTrophy({ trophy, index }: { trophy: Trophy; index: number }) {
	const visual = getTrophyVisual(trophy);
	const tier = getTierVisual(trophy.tier);

	return (
		<Reveal
			index={index}
			className={cn(
				"relative flex min-w-0 flex-col items-center gap-2 overflow-hidden rounded-xl border bg-card px-2 pt-3 pb-2.5 text-center",
				tier.tileClassName,
			)}
		>
			{trophy.tier === "major" ? (
				// Soft podium-gold wash behind a major trophy.
				<div
					aria-hidden='true'
					className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--color-rank-1),transparent_70%)] opacity-10'
				/>
			) : null}
			<div
				className={cn(
					"relative flex size-11 items-center justify-center rounded-full border",
					visual.ringClassName,
				)}
			>
				<visual.Icon className={cn("size-5", visual.textClassName)} />
			</div>
			<div className='relative w-full min-w-0'>
				<p
					className={cn(
						"truncate text-[11px] font-semibold uppercase tracking-wider",
						visual.textClassName,
					)}
				>
					{visual.label}
				</p>
				<p className='truncate text-xs text-foreground'>
					{trophy.seriesTitle}
				</p>
			</div>
			{tier.tagClassName ? (
				<span
					className={cn(
						"relative rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider",
						tier.tagClassName,
					)}
				>
					{tier.label}
				</span>
			) : null}
		</Reveal>
	);
}

export function TrophyShowcaseSkeleton() {
	return (
		<div aria-hidden='true' className='flex flex-col gap-3'>
			<div className='grid grid-cols-3 gap-2'>
				{Array.from({ length: FEATURED_COUNT }).map((_, i) => (
					<Skeleton key={i} className='h-30 rounded-xl' />
				))}
			</div>
			<Skeleton className='h-6 w-48 rounded-full' />
		</div>
	);
}

// The best few trophies up front, then a one-line count of everything.
export function TrophyShowcase({
	trophies,
	isLoading,
	onViewAll,
}: Readonly<Props>) {
	if (isLoading) return <TrophyShowcaseSkeleton />;

	if (trophies.length === 0) {
		return (
			<p className='rounded-xl border border-dashed border-border/80 px-4 py-5 text-center text-sm text-muted-foreground'>
				No trophies yet. Finish top 3 in a series to earn one.
			</p>
		);
	}

	const featured = trophies.slice(0, FEATURED_COUNT);
	const tally = buildTally(trophies);

	return (
		<div className='flex flex-col gap-3'>
			<div className='grid grid-cols-3 gap-2'>
				{featured.map((trophy, index) => (
					<FeaturedTrophy key={trophy.id} trophy={trophy} index={index} />
				))}
			</div>

			<div className='flex items-start gap-2'>
				<ul className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
					{tally.map((item) => (
						<li
							key={item.key}
							aria-label={item.label}
							title={item.label}
							className='flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-xs font-medium tabular-nums text-foreground'
						>
							<item.visual.Icon
								aria-hidden='true'
								className={cn("size-3.5", item.visual.textClassName)}
							/>
							×{item.count}
						</li>
					))}
				</ul>
				<button
					type='button'
					onClick={onViewAll}
					className='flex shrink-0 items-center gap-0.5 rounded-md py-0.5 pl-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
				>
					View all
					<ChevronRightIcon className='size-3.5' />
				</button>
			</div>
		</div>
	);
}
