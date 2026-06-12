import { PredictionHistoryEntry } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
	CheckCircle2,
	XCircle,
	MinusCircle,
	CrownIcon,
	TrendingUpIcon,
} from "lucide-react";
import Dot from "@/components/ui/dot";
import { Link } from "react-router-dom";
import { FadeContent } from "@/components";

// ─── PredictionHistoryCard ────────────────────────────────────────────────────

function statusMeta(status: PredictionHistoryEntry["status"]) {
	switch (status) {
		case "revealed":
			return {
				icon: <CheckCircle2 className='size-4 text-win' />,
				label: "Resolved",
			};
		case "cancelled":
			return {
				icon: <XCircle className='size-4 text-destructive' />,
				label: "Cancelled",
			};
		case "no_result":
			return {
				icon: <MinusCircle className='size-4 text-muted-foreground' />,
				label: "No result",
			};
	}
}

type CardProps = {
	entry: PredictionHistoryEntry;
};

function PredictionHistoryCard({ entry }: Readonly<CardProps>) {
	const meta = statusMeta(entry.status);
	const total =
		entry.options?.reduce((s, o) => s + o.total_bet, 0) ?? entry.total_pool;
	const winner = entry.options?.find((o) => o.id === entry.winning_option_id);
	const participants = entry.participant_count ?? entry.total_bets;

	const winPct =
		participants > 0
			? Math.round((entry.winner_count / participants) * 100)
			: null;

	const resolvedLabel = entry.resolved_at
		? new Date(entry.resolved_at).toLocaleString(undefined, {
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
			})
		: null;

	let payoutSummary: JSX.Element | string;
	if (entry.status !== "revealed") {
		payoutSummary = entry.no_result_reason ?? "No payout distributed.";
	} else if (entry.winner_count === 0) {
		payoutSummary = "Nobody guessed correctly 💀";
	} else {
		const winnerLabel = entry.winner_count === 1 ? "winner" : "winners";
		payoutSummary = (
			<p className={`text-muted-foreground`}>
				<TrendingUpIcon
					className={`w-3 h-3 inline-block mr-2 text-green-500`}
				/>
				<span className={`text-sm text-foreground font-semibold`}>
					+{entry.total_paid_to_winners.toLocaleString()} pts
				</span>{" "}
				paid to {entry.winner_count} {winnerLabel}
			</p>
		);
	}

	const isUpset = entry.status === "revealed" && (winPct ?? 100) <= 25;
	const isSweep = entry.status === "revealed" && (winPct ?? 0) >= 80;

	const isWin =
		entry.selected_option_id === entry.winning_option_id &&
		entry.status === "revealed";
	const isLoss =
		entry.selected_option_id !== null &&
		!isWin &&
		entry.status === "revealed";

	let borderClass = "border-muted/30";
	if (isWin) {
		borderClass = "border-win/30";
	} else if (isLoss) {
		borderClass = "border-loss/30";
	}

	return (
		<Link
			to={`predictions/${entry.prediction_id}`}
			className={`border-2 rounded-xl p-3 flex flex-col gap-2 hover:bg-secondary/50 transition-colors ${borderClass}`}
		>
			{/* Header row */}
			<div className='flex items-start gap-2'>
				<div className='mt-0.5 shrink-0'>{meta.icon}</div>
				<p className='text-sm font-medium flex-1 leading-snug'>
					{entry.title}
				</p>
				{resolvedLabel && (
					<span className='text-xs text-muted-foreground shrink-0'>
						{resolvedLabel}
					</span>
				)}
			</div>

			{/* Winner pill */}
			{entry.status === "revealed" && winner && (
				<div className='flex items-center gap-1.5 flex-wrap'>
					<span className='text-xs text-muted-foreground'>
						Winner:
					</span>
					<Badge className='text-xs bg-win/20 text-win font-semibold'>
						<CrownIcon />
						{winner.label}
					</Badge>
					{entry.selected_option_label && (
						<>
							<Dot />
							<span className='text-xs text-muted-foreground'>
								Your pick:
							</span>
							<span
								className={`text-xs font-semibold ${entry.selected_option_id === entry.winning_option_id ? "text-win" : "text-loss"}`}
							>
								{entry.selected_option_label}
							</span>
						</>
					)}
					{isUpset && (
						<Badge variant='secondary' className='text-xs'>
							Upset ⚡
						</Badge>
					)}
					{isSweep && (
						<Badge variant='secondary' className='text-xs'>
							Sweep 🧹
						</Badge>
					)}
				</div>
			)}

			{/* Option bars */}
			{entry.options && total > 0 && (
				<div className='flex flex-col gap-1 my-1'>
					{entry.options.map((opt) => {
						const pct =
							total > 0
								? Math.round((opt.total_bet / total) * 100)
								: 0;
						const isWinner = opt.id === entry.winning_option_id;
						return (
							<div
								key={opt.id}
								className='flex items-center gap-2'
							>
								<p className={`text-xs w-13 truncate`}>
									{opt.label}
								</p>
								<div className='flex-1 h-2 rounded-full bg-muted overflow-hidden'>
									<div
										className={cn(
											"h-full rounded-full transition-all",
											isWinner
												? "bg-win"
												: "bg-muted-foreground/40",
										)}
										style={{ width: `${pct}%` }}
									/>
								</div>
								<span
									className={cn(
										"text-xs tabular-nums w-8 text-right",
										isWinner
											? "text-win font-medium"
											: "text-muted-foreground",
									)}
								>
									{pct}%
								</span>
							</div>
						);
					})}
				</div>
			)}

			{/* Footer meta */}
			<div className='flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground'>
				{total > 0 && <span>Pool: {total.toLocaleString()} pts</span>}
				{participants > 0 && (
					<>
						<Dot />
						{participants} predictors
						{participants === 1 ? "" : "s"}
					</>
				)}
				{winPct !== null && entry.status === "revealed" && (
					<>
						<Dot />
						<span>{winPct}% called it</span>
					</>
				)}
			</div>

			<div className='rounded-md bg-muted/40 px-2.5 py-2 text-xs space-y-0.5'>
				<p className='font-medium text-foreground'>{payoutSummary}</p>
				{entry.status === "revealed" && entry.biggest_payout > 0 && (
					<p className='text-muted-foreground'>
						Biggest payout:{" "}
						<span className={`text-win font-semibold`}>
							+{entry.biggest_payout.toLocaleString()} pts
						</span>
					</p>
				)}
			</div>
		</Link>
	);
}

// ─── PredictionHistoryFeed ────────────────────────────────────────────────────

type FeedProps = {
	entries: PredictionHistoryEntry[];
	isLoading: boolean;
};

export function PredictionHistoryFeed({
	entries,
	isLoading,
}: Readonly<FeedProps>) {
	if (isLoading) {
		return (
			<div className='flex flex-col gap-2'>
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className='h-24 w-full rounded-xl' />
				))}
			</div>
		);
	}

	if (entries.length === 0) {
		return (
			<div className='flex flex-col items-center gap-2 py-12 text-center'>
				<p className='text-4xl'>📭</p>
				<p className='text-muted-foreground text-sm'>
					No resolved predictions yet. Check back after the next one
					wraps up.
				</p>
			</div>
		);
	}

	return (
		<div className='flex flex-col gap-4'>
			{entries.map((entry) => (
				<FadeContent key={entry.prediction_id}>
					<PredictionHistoryCard entry={entry} />
				</FadeContent>
			))}
		</div>
	);
}
