import { Reveal } from "@/shared/ui";
import { getSeriesAwardValue } from "@/shared/lib/seriesRewards";
import { getTrophyVisual } from "@/shared/lib/seriesRecognitionVisuals";
import {
	SERIES_TIER_ORDER,
	type SeriesTier,
	type Trophy,
} from "@/shared/lib/trophyPrestige";
import { cn } from "@/shared/lib/utils";
import { ChevronLeftIcon } from "lucide-react";

type Props = {
	trophies: Trophy[];
	onBack: () => void;
};

const TIER_HEADING: Record<SeriesTier, string> = {
	major: "Major series",
	standard: "Series",
	minor: "Minor series",
};

function formatWonAt(value: string) {
	return new Date(value).toLocaleDateString(undefined, {
		month: "short",
		year: "numeric",
	});
}

function TrophyRow({ trophy, index }: { trophy: Trophy; index: number }) {
	const visual = getTrophyVisual(trophy);
	const detail =
		trophy.kind === "award"
			? `${getSeriesAwardValue(trophy.awardType, trophy.value)} · ${formatWonAt(trophy.wonAt)}`
			: formatWonAt(trophy.wonAt);

	return (
		<Reveal
			as='li'
			index={index}
			className='flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3'
		>
			<div
				className={cn(
					"flex size-10 shrink-0 items-center justify-center rounded-full border",
					visual.ringClassName,
				)}
			>
				<visual.Icon className={cn("size-5", visual.textClassName)} />
			</div>
			<div className='min-w-0 flex-1'>
				<p className='truncate text-sm font-semibold text-foreground'>
					{trophy.seriesTitle}
				</p>
				<p className='truncate text-xs text-muted-foreground'>
					<span className={visual.textClassName}>{visual.label}</span>
					{" · "}
					{detail}
				</p>
			</div>
		</Reveal>
	);
}

// Every trophy, grouped by how big the series was.
export function TrophyCabinet({ trophies, onBack }: Readonly<Props>) {
	const groups = SERIES_TIER_ORDER.map((tier) => ({
		tier,
		items: trophies.filter((trophy) => trophy.tier === tier),
	})).filter((group) => group.items.length > 0);

	return (
		<div className='flex flex-col gap-4'>
			<button
				type='button'
				onClick={onBack}
				className='flex w-fit items-center gap-1 rounded-md py-0.5 pr-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
			>
				<ChevronLeftIcon className='size-4' />
				Back to card
			</button>

			{groups.map((group) => (
				<section key={group.tier} className='flex flex-col gap-2'>
					<h3 className='flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
						{TIER_HEADING[group.tier]}
						<span className='tabular-nums'>{group.items.length}</span>
					</h3>
					<ul className='flex flex-col gap-2'>
						{group.items.map((trophy, index) => (
							<TrophyRow key={trophy.id} trophy={trophy} index={index} />
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
