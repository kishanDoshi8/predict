import { Badge } from "@/components";
import { DuelSummary } from "@/types";
import { Swords, UsersIcon } from "lucide-react";

type DuelSummaryCardProps = {
	summary: DuelSummary;
	onClick: () => void;
};

export function DuelSummaryCard({
	summary,
	onClick,
}: Readonly<DuelSummaryCardProps>) {
	let stakeRangeLabel = "-";

	if (summary.minStake !== null && summary.maxStake !== null) {
		if (summary.minStake === summary.maxStake) {
			stakeRangeLabel = `${summary.minStake} PTS`;
		} else {
			stakeRangeLabel = `${summary.minStake} - ${summary.maxStake} PTS`;
		}
	}

	return (
		<button
			type='button'
			onClick={onClick}
			className='w-full text-left rounded-2xl transition p-5 border border-accent/20 bg-[rgba(40,40,40,0.70)] shadow-[2px_4px_16px_0px_rgba(248,248,248,0.06)_inset]'
		>
			<div className='flex items-start justify-between gap-3'>
				<div>
					<p className='text-lg font-semibold'>Duels</p>
					<p className='text-xs text-muted-foreground'>
						Duels auto resolve when prediction is resolved
					</p>
				</div>
				<Badge className='bg-primary/20 text-primary'>
					<Swords className='h-3 w-3 mr-1' />
					{summary.activeDuelsCount} Active
				</Badge>
			</div>
			<div className='mt-3 flex text-sm items-end gap-4'>
				<div className='mt-4 flex-1'>
					<p className='text-muted-foreground text-xs'>Stake Range</p>
					<p className='font-medium'>{stakeRangeLabel}</p>
				</div>
				<div className='flex gap-2 items-center mt-4'>
					<p className='text-muted-foreground text-xs'>
						<UsersIcon className='inline-block h-3 w-3' />
					</p>
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
