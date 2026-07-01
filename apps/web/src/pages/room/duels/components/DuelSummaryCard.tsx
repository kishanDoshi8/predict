import { Badge } from "@/components";
import { DuelSummary } from "@/types";
import { Swords } from "lucide-react";

type DuelSummaryCardProps = {
	summary: DuelSummary;
	onClick: () => void;
};

export function DuelSummaryCard({
	summary,
	onClick,
}: Readonly<DuelSummaryCardProps>) {
	const stakeRangeLabel =
		summary.minStake !== null && summary.maxStake !== null
			? `${summary.minStake} - ${summary.maxStake} PTS`
			: "No active stake range";

	return (
		<button
			type='button'
			onClick={onClick}
			className='w-full text-left rounded-2xl border border-primary/30 bg-linear-to-br from-primary/20 via-card to-accent/10 p-4 transition hover:border-primary/50 hover:bg-primary/10'
		>
			<div className='flex items-start justify-between gap-3'>
				<div>
					<p className='text-xs text-muted-foreground'>
						Duel Layer
					</p>
					<p className='text-lg font-semibold'>Prediction Duels</p>
				</div>
				<Badge className='bg-primary/20 text-primary'>
					<Swords className='h-3 w-3 mr-1' />
					{summary.activeDuelsCount} Active
				</Badge>
			</div>
			<div className='mt-3 grid grid-cols-2 gap-3 text-sm'>
				<div className='rounded-lg border border-border bg-card p-3'>
					<p className='text-muted-foreground text-xs'>Stake Range</p>
					<p className='font-medium'>{stakeRangeLabel}</p>
				</div>
				<div className='rounded-lg border border-border bg-card p-3'>
					<p className='text-muted-foreground text-xs'>Queue Players</p>
					<p className='font-medium'>
						{summary.queuePlayersCount.toLocaleString()}
					</p>
				</div>
			</div>
			{summary.openDuelsAvailable && (
				<p className='mt-3 text-xs text-primary font-medium'>
					Open duels are available now.
				</p>
			)}
		</button>
	);
}
