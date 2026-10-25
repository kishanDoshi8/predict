import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui";
import { cn, formatSignedPoints } from "@/shared/lib/utils";
import { CoinsIcon } from "lucide-react";
import type { SeriesWallet } from "@/shared/lib/api";

type Props = {
	wallet: SeriesWallet;
};

// Header points chip; tapping explains where the number comes from.
export function WalletPopover({ wallet }: Readonly<Props>) {
	const rows: Array<[string, string, string?]> = [
		["Available to bet", wallet.available.toLocaleString()],
		["In open bets", wallet.escrow.toLocaleString()],
		[
			"Net this series",
			formatSignedPoints(wallet.net_profit),
			wallet.net_profit > 0
				? "text-win"
				: wallet.net_profit < 0
					? "text-loss"
					: undefined,
		],
		["Starting points", wallet.starting_stack.toLocaleString()],
	];

	return (
		<Popover>
			<PopoverTrigger
				className='flex items-center gap-1.5 rounded-full px-3 h-9 text-accent font-semibold tabular-nums hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
				aria-label={`${wallet.balance.toLocaleString()} points in ${wallet.title}`}
			>
				<CoinsIcon className='size-4' />
				{wallet.balance.toLocaleString()}
			</PopoverTrigger>
			<PopoverContent align='end' className='w-64'>
				<p className='text-xs text-muted-foreground'>Your points in</p>
				<p className='font-semibold truncate'>{wallet.title}</p>
				<dl className='mt-3 flex flex-col gap-2 text-sm'>
					{rows.map(([label, value, tone]) => (
						<div key={label} className='flex justify-between gap-3'>
							<dt className='text-muted-foreground'>{label}</dt>
							<dd className={cn("tabular-nums font-medium", tone)}>
								{value}
							</dd>
						</div>
					))}
				</dl>
				{wallet.status === "active" && wallet.weekly_topup > 0 ? (
					<p className='mt-3 rounded-md bg-accent/10 px-2 py-1.5 text-xs'>
						+{wallet.weekly_topup.toLocaleString()} every Monday if you bet
						that week.
					</p>
				) : null}
			</PopoverContent>
		</Popover>
	);
}
