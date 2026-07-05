import { SectionLabel } from "@/features/duels/components/detail/DuelDetailShared";
import { fmtPts } from "@/features/duels/lib/duelDetailUtils";

export function StakeBreakdown({
	stake,
	fee,
	pot,
	potLabel = "Potential win",
}: Readonly<{
	stake: number;
	fee: number;
	pot: number;
	potLabel?: string;
}>) {
	return (
		<div className='rounded-2xl border border-border bg-card p-4'>
			<SectionLabel>Stake Breakdown</SectionLabel>
			<div className='mt-3 space-y-2 text-sm'>
				<div className='flex items-center justify-between'>
					<span className='text-muted-foreground'>Stake</span>
					<span className='font-mono tabular-nums'>
						{fmtPts(stake)} pts
					</span>
				</div>
				<div className='flex items-center justify-between'>
					<span className='text-muted-foreground'>Fee</span>
					<span className='font-mono tabular-nums'>
						{fmtPts(fee)} pts
					</span>
				</div>
				<div className='my-2 h-px bg-border' />
				<div className='flex items-center justify-between text-base font-semibold'>
					<span>{potLabel}</span>
					<span className='font-mono tabular-nums text-win'>
						+{fmtPts(pot)} pts
					</span>
				</div>
			</div>
		</div>
	);
}
