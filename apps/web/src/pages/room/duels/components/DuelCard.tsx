import { Badge } from "@/components";
import { Duel } from "@/types";

type DuelCardProps = {
	duel: Duel;
	challengerLabel: string;
	opponentLabel: string | null;
	outcomeLabel: string | null;
};

const STATUS_LABEL: Record<Duel["status"], string> = {
	created: "Created",
	queued: "Queued",
	matched: "Matched",
	resolved: "Resolved",
	cancelled: "Cancelled",
	expired: "Expired",
};

export function DuelCard({
	duel,
	challengerLabel,
	opponentLabel,
	outcomeLabel,
}: Readonly<DuelCardProps>) {
	return (
		<div className='rounded-xl border border-border bg-card p-4'>
			<div className='flex items-center justify-between gap-2'>
				<p className='text-sm text-muted-foreground'>Duel</p>
				<Badge variant='secondary'>{STATUS_LABEL[duel.status]}</Badge>
			</div>
			<div className='mt-2 space-y-1 text-sm'>
				<p>
					<span className='text-muted-foreground'>Challenger:</span>{" "}
					{challengerLabel}
				</p>
				<p>
					<span className='text-muted-foreground'>Stake:</span>{" "}
					{duel.stake_amount.toLocaleString()} PTS
				</p>
				<p>
					<span className='text-muted-foreground'>Queue status:</span>{" "}
					{STATUS_LABEL[duel.status]}
				</p>
				<p>
					<span className='text-muted-foreground'>Players in queue:</span>{" "}
					{duel.queue_count}
				</p>
				{opponentLabel && (
					<p>
						<span className='text-muted-foreground'>Opponent:</span>{" "}
						{opponentLabel}
					</p>
				)}
				{outcomeLabel && (
					<p>
						<span className='text-muted-foreground'>Outcome:</span>{" "}
						{outcomeLabel}
					</p>
				)}
			</div>
		</div>
	);
}
