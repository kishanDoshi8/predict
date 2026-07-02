import { Button, Spinner } from "@/components";
import { cn } from "@/lib/utils";
import { useMyBet, useBets } from "@/store/bet";
import {
	useCancelDuel,
	useJoinDuelQueue,
	usePredictionDuels,
} from "@/store/duel";
import { usePlayer } from "@/store/player";
import { usePrediction } from "@/store/prediction";
import { Duel } from "@/types";
import {
	Ban,
	Check,
	ChevronLeft,
	Clock,
	Crown,
	Flame,
	Hourglass,
	HourglassIcon,
	Info,
	Lock,
	RotateCw,
	Sparkles,
	Swords,
	Trophy,
	UserCheckIcon,
	Users,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useRoomContext } from "../RoomLayout";

type DuelVisualState =
	| "join"
	| "matched"
	| "resolved"
	| "expired"
	| "cancelled";

type DuelQueueRowStatus = "matched" | "refunded" | "waiting";

type DuelQueueRow = {
	position: number;
	username: string;
	player_id?: string | null;
	status: DuelQueueRowStatus;
	is_you?: boolean;
};

type DuelResolutionMeta = {
	winner_player_id?: string | null;
	payout_for_current_user?: number | null;
	pot_amount?: number | null;
	queued_refunded_count?: number | null;
	rivalry_update?: string | null;
	refund_note?: string | null;
	has_result?: boolean;
};

type DuelRivalryMeta = {
	label?: string | null;
	record?: string | null;
	nth_duel?: string | null;
	note?: string | null;
};

type DuelEligibilityMeta = {
	eligible: boolean;
	reason?: string | null;
};

type DuelDetailExtras = {
	ui_state?: DuelVisualState;
	eligibility?: DuelEligibilityMeta;
	ineligibility_reason?: string | null;
	rivalry?: DuelRivalryMeta | null;
	escrow_bullets?: string[];
	queue_preview_usernames?: string[];
	queue_position_for_current_user?: number;
	queue_rows?: DuelQueueRow[];
	cancellation_reason?: string | null;
	resolved?: DuelResolutionMeta | null;
};

type DuelWithDetail = Duel & DuelDetailExtras;

type BetWithOption = {
	id: string;
	player_id: string;
	option_id: string;
	amount: number;
	payout: number | null;
	option?: {
		id: string;
		label: string;
	} | null;
};

function toVisualState(duel: DuelWithDetail): DuelVisualState {
	if (duel.ui_state) return duel.ui_state;
	if (duel.status === "matched") return "matched";
	if (duel.status === "resolved") return "resolved";
	if (duel.status === "expired") return "expired";
	if (duel.status === "cancelled") return "cancelled";
	return "join";
}

function initials(name: string | null | undefined) {
	if (!name) return "??";
	return name.slice(0, 2).toUpperCase();
}

function fmtPts(value: number | null | undefined) {
	if (typeof value !== "number" || Number.isNaN(value)) return "0";
	return value.toLocaleString();
}

function signedPts(value: number) {
	if (value === 0) return "0";
	return value > 0 ? `+${fmtPts(value)}` : `-${fmtPts(Math.abs(value))}`;
}

function getPickLabel(
	betId: string | null | undefined,
	betsById: Map<string, BetWithOption>,
	fallbackLabel = "Pick",
) {
	if (!betId) return fallbackLabel;
	const bet = betsById.get(betId);
	return bet?.option?.label ?? fallbackLabel;
}

function getPickOptionId(
	betId: string | null | undefined,
	betsById: Map<string, BetWithOption>,
) {
	if (!betId) return null;
	return betsById.get(betId)?.option_id ?? null;
}

function PickChip({
	label,
	hidden = false,
}: Readonly<{ label: string; hidden?: boolean }>) {
	if (hidden) {
		return (
			<span className='inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
				<Lock className='size-3' />
				Hidden
			</span>
		);
	}

	return (
		<span className='inline-flex items-center rounded-full border border-border bg-secondary px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground'>
			{label}
		</span>
	);
}

function DuelAvatarTile({
	name,
	hidden = false,
	ring = false,
	size = "md",
}: Readonly<{
	name: string | null | undefined;
	hidden?: boolean;
	ring?: boolean;
	size?: "sm" | "md" | "lg" | "xl";
}>) {
	const sizeClass = {
		sm: "size-9 text-xs",
		md: "size-12 text-sm",
		lg: "size-14 text-base",
		xl: "size-16 text-lg",
	}[size];

	return (
		<div
			className={cn(
				"relative grid place-items-center rounded-2xl bg-linear-to-br from-primary/35 to-accent/35 text-foreground font-semibold",
				sizeClass,
				ring && "ring-2 ring-win ring-offset-2 ring-offset-background",
			)}
		>
			{hidden ? (
				<Lock className='size-5' aria-hidden='true' />
			) : (
				initials(name)
			)}
		</div>
	);
}

function SectionLabel({ children }: Readonly<{ children: string }>) {
	return (
		<p className='text-xs font-bold uppercase tracking-wider text-muted-foreground'>
			{children}
		</p>
	);
}

function VsMatchup({
	leftName,
	rightName,
	leftPickLabel,
	rightPickLabel,
	leftPickHidden = false,
	rightPickHidden = false,
	leftRing = false,
	rightRing = false,
	stake,
	rightEmptyLabel,
}: Readonly<{
	leftName: string | null | undefined;
	rightName: string | null | undefined;
	leftPickLabel: string;
	rightPickLabel: string;
	leftPickHidden?: boolean;
	rightPickHidden?: boolean;
	leftRing?: boolean;
	rightRing?: boolean;
	stake: number;
	rightEmptyLabel?: string;
}>) {
	return (
		<div className='rounded-2xl border border-border bg-card p-5'>
			<div className='relative grid grid-cols-[1fr_auto_1fr] items-center gap-3'>
				<div className='flex flex-col items-center gap-2 text-center'>
					<DuelAvatarTile
						name={leftName}
						ring={leftRing}
						size='lg'
						hidden={leftPickHidden && !leftName}
					/>
					<p className='line-clamp-1 text-sm font-semibold'>
						{leftName ?? "Challenger"}
					</p>
					<PickChip label={leftPickLabel} hidden={leftPickHidden} />
				</div>

				<div className='flex flex-col items-center gap-2'>
					<span className='rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-bold tracking-wider'>
						VS
					</span>
					<p className='text-center text-xs font-bold uppercase tracking-wider text-muted-foreground'>
						Stake
					</p>
					<p className='font-mono text-2xl font-bold tabular-nums text-win'>
						{fmtPts(stake)}
					</p>
				</div>

				<div className='flex flex-col items-center gap-2 text-center'>
					{rightEmptyLabel ? (
						<div className='grid size-14 place-items-center rounded-2xl border border-dashed border-border bg-secondary/50 text-muted-foreground'>
							<X className='size-4' aria-hidden='true' />
						</div>
					) : (
						<DuelAvatarTile
							name={rightName}
							ring={rightRing}
							size='lg'
							hidden={rightPickHidden && !rightName}
						/>
					)}
					<p className='line-clamp-1 text-sm font-semibold'>
						{rightEmptyLabel ?? rightName ?? "Opponent"}
					</p>
					{rightEmptyLabel ? (
						<span className='inline-flex items-center rounded-full border border-border bg-secondary px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
							No match
						</span>
					) : (
						<PickChip
							label={rightPickLabel}
							hidden={rightPickHidden}
						/>
					)}
				</div>
			</div>
		</div>
	);
}

function EscrowCard({
	amount,
	lines,
}: Readonly<{ amount: number; lines: string[] }>) {
	return (
		<div className='rounded-2xl border border-border bg-secondary/40 p-4'>
			<div className='mb-3 flex items-center justify-between'>
				<SectionLabel>You commit to escrow</SectionLabel>
				<span className='rounded-full bg-secondary px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-accent'>
					Held
				</span>
			</div>
			<div className='mb-3 flex items-end gap-1'>
				<p className='font-mono text-2xl font-semibold tabular-nums text-foreground'>
					{fmtPts(amount)}
				</p>
				<p className='pb-1 text-xs uppercase tracking-wider text-muted-foreground'>
					pts
				</p>
			</div>
			<ul className='space-y-2 text-sm text-muted-foreground *:flex *:gap-2 *:items-start'>
				<li>
					<UserCheckIcon className={`text-primary w-5 h-5`} />
					<p className={`flex-1/6`}>
						You're only matched if your pick differs from your
						opponent's pick.
					</p>
				</li>
				<li>
					<HourglassIcon className={`text-accent w-5 h-5`} />
					<p className={`flex-1/6`}>
						If someone ahead of you matches first, your escrow is
						refunded.
					</p>
				</li>
				{/* {lines.map((line) => (
					<li key={line} className='flex items-start gap-2'>
						<span
							aria-hidden='true'
							className='mt-1 size-1.5 rounded-full bg-accent'
						/>
						<span>{line}</span>
					</li>
				))} */}
			</ul>
		</div>
	);
}

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

function StatusBanner({
	icon,
	title,
	subtitle,
	variant = "neutral",
	extra,
}: Readonly<{
	icon: React.ReactNode;
	title: string;
	subtitle: string;
	variant?: "neutral" | "primary" | "win";
	extra?: React.ReactNode;
}>) {
	const styles = {
		neutral: "bg-secondary/50",
		primary: "bg-primary/15 border-primary/30",
		win: "bg-win/15 border-win/30",
	}[variant];

	return (
		<div className={cn("rounded-2xl border border-border p-5", styles)}>
			<div className='mb-2 inline-flex rounded-full border border-border bg-card/80 p-2'>
				{icon}
			</div>
			<h2 className='text-xl font-semibold'>{title}</h2>
			<p className='mt-1 text-sm text-muted-foreground'>{subtitle}</p>
			{extra ? <div className='mt-4'>{extra}</div> : null}
		</div>
	);
}

function StickyActionBar({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className='fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-4 backdrop-blur-xl'>
			<div className='mx-auto flex w-full max-w-md flex-col gap-2'>
				{children}
			</div>
		</div>
	);
}

export function PredictionDuelDetailPage() {
	const { predictionId, duelId } = useParams<{
		predictionId: string;
		duelId: string;
	}>();
	const navigate = useNavigate();
	const { room } = useRoomContext();

	const { data: player } = usePlayer();
	const { data: prediction } = usePrediction(room.id, predictionId);
	const { data: duels = [] } = usePredictionDuels(room.id, predictionId);
	const { data: bets = [] } = useBets(room.id, predictionId);
	const { data: myBet } = useMyBet(
		room.id,
		predictionId ?? "",
		player?.id ?? "",
	);
	const { mutate: joinDuelQueue, isPending: isJoining } = useJoinDuelQueue();
	const { mutate: cancelDuel, isPending: isCancelling } = useCancelDuel();

	const duel = useMemo(
		() =>
			duels.find((item) => item.id === duelId) as
				| DuelWithDetail
				| undefined,
		[duelId, duels],
	);

	const betsById = useMemo(
		() => new Map((bets as BetWithOption[]).map((bet) => [bet.id, bet])),
		[bets],
	);

	const currentUserId = player?.id ?? null;
	const isCurrentUserChallenger =
		currentUserId != null && duel?.challenger_player_id === currentUserId;
	const visualState = duel ? toVisualState(duel) : null;

	const challengerPickLabel = duel
		? getPickLabel(duel.challenger_bet_id, betsById, "Challenger pick")
		: "Challenger pick";
	const opponentPickLabel = duel
		? getPickLabel(duel.matched_opponent_bet_id, betsById, "Opponent pick")
		: "Opponent pick";
	const myPickLabel = myBet?.option_id
		? (prediction?.prediction_options.find(
				(opt) => opt.id === myBet.option_id,
			)?.label ?? "My pick")
		: "My pick";

	const challengerPickOptionId = duel
		? getPickOptionId(duel.challenger_bet_id, betsById)
		: null;
	const myPickOptionId = myBet?.option_id ?? null;

	const detailEligibility = duel?.eligibility;
	const inferredEligible =
		!detailEligibility &&
		!!duel &&
		!!player &&
		!!myBet &&
		!isCurrentUserChallenger &&
		prediction?.status === "draft";
	const eligible = detailEligibility
		? detailEligibility.eligible
		: inferredEligible;
	const ineligibleReason =
		detailEligibility?.reason ??
		duel?.ineligibility_reason ??
		(!myBet
			? "Place a qualifying bet before joining this duel."
			: isCurrentUserChallenger
				? "You cannot join your own duel."
				: challengerPickOptionId &&
					  myPickOptionId &&
					  challengerPickOptionId === myPickOptionId
					? "You must have a different pick from the challenger to match."
					: "This duel is not currently joinable.");

	const queuePreview =
		duel?.queue_preview_usernames ?? duel?.queued_player_usernames ?? [];
	const queuePosition =
		duel?.queue_position_for_current_user ??
		(duel?.queue_count ? duel.queue_count + 1 : 1);

	const queueRows: DuelQueueRow[] =
		duel?.queue_rows ??
		(duel?.queued_player_usernames ?? []).map((username, index) => ({
			position: index + 1,
			username,
			status: "waiting",
		}));

	const rival = duel?.rivalry;
	const escrowBullets = duel?.escrow_bullets ?? [
		"👥 Match happens only when the opponent pick differs from the challenger.",
		" If someone ahead in queue matches first, held points are refunded automatically.",
	];

	const resolvedMeta = duel?.resolved ?? null;
	const inferredPot = duel ? duel.stake_amount * 2 : 0;
	const payoutForCurrentUser =
		resolvedMeta?.payout_for_current_user ??
		(duel && duel.status === "resolved" && currentUserId
			? resolvedMeta?.winner_player_id === currentUserId
				? duel.stake_amount
				: -duel.stake_amount
			: 0);
	const isWin = !!(
		duel &&
		currentUserId &&
		resolvedMeta?.winner_player_id === currentUserId
	);

	const [showWinBurst, setShowWinBurst] = useState(false);
	useEffect(() => {
		if (visualState !== "resolved" || !isWin) return;
		setShowWinBurst(true);
		const timer = window.setTimeout(() => setShowWinBurst(false), 1500);
		return () => window.clearTimeout(timer);
	}, [isWin, visualState]);

	if (!duel || !player || !prediction || !visualState) {
		return (
			<div className='mx-auto flex min-h-[40vh] max-w-md items-center justify-center px-4'>
				<div className='rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground'>
					<Spinner className='mx-auto mb-2' />
					Loading duel details...
				</div>
			</div>
		);
	}

	const onBack = () => {
		navigate(`/rooms/${room.code}/predictions/${predictionId}/duels`);
	};

	const onCommitEscrow = () => {
		if (!player || !duel || !myBet) return;
		joinDuelQueue(
			{
				roomId: room.id,
				predictionId: prediction.id,
				duelId: duel.id,
				playerId: player.id,
				betId: myBet.id,
			},
			{
				onSuccess: () => {
					toast.success("Joined duel queue.");
				},
				onError: (error) => {
					toast.error("Could not join duel queue.", {
						description: error.message,
					});
				},
			},
		);
	};

	const onCancelDuel = () => {
		if (!player || !duel) return;
		cancelDuel(
			{
				roomId: room.id,
				predictionId: prediction.id,
				duelId: duel.id,
				playerId: player.id,
			},
			{
				onSuccess: () => {
					toast.success("Duel cancelled.");
				},
				onError: (error) => {
					toast.error("Could not cancel duel.", {
						description: error.message,
					});
				},
			},
		);
	};

	const renderJoin = () => {
		return (
			<>
				<VsMatchup
					leftName={duel.challenger_username}
					rightName={player.username}
					leftPickLabel={challengerPickLabel}
					rightPickLabel={myPickLabel}
					leftPickHidden
					rightRing
					stake={duel.stake_amount}
				/>

				{rival &&
				(rival.label ||
					rival.record ||
					rival.nth_duel ||
					rival.note) ? (
					<div className='rounded-2xl border border-border bg-primary/10 p-4'>
						<div className='mb-2 flex items-center gap-2 text-primary'>
							<Flame className='size-4' aria-hidden='true' />
							<SectionLabel>Rivalry</SectionLabel>
						</div>
						<p className='text-sm font-semibold'>
							{rival.label ?? "Head-to-head streak"}
						</p>
						{rival.record ? (
							<p className='text-sm text-muted-foreground'>
								{rival.record}
							</p>
						) : null}
						{rival.nth_duel ? (
							<p className='text-sm text-muted-foreground'>
								{rival.nth_duel}
							</p>
						) : null}
						{rival.note ? (
							<p className='text-xs text-muted-foreground'>
								{rival.note}
							</p>
						) : null}
					</div>
				) : null}

				<EscrowCard amount={duel.stake_amount} lines={escrowBullets} />

				<div className='rounded-2xl border border-border bg-card p-4'>
					<SectionLabel>Queue Preview</SectionLabel>
					<div className='mt-3 flex items-center justify-between'>
						<div className='flex -space-x-2'>
							{queuePreview.slice(0, 4).map((name) => (
								<DuelAvatarTile
									key={`${name}`}
									name={name}
									size='sm'
								/>
							))}
							{queuePreview.length === 0 ? (
								<div className='inline-flex items-center gap-2 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground'>
									<Users
										className='size-3'
										aria-hidden='true'
									/>
									No one queued yet
								</div>
							) : null}
						</div>
						<span className='rounded-full border border-border bg-secondary px-2 py-1 font-mono text-xs tabular-nums'>
							#{queuePosition}
						</span>
					</div>
				</div>

				{/* <StakeBreakdown
					stake={duel.stake_amount}
					fee={duel.fee_amount}
					pot={duel.stake_amount}
					potLabel='Potential win'
				/> */}

				{eligible ? null : (
					<div className='rounded-2xl border border-border bg-secondary/50 p-4 text-sm text-muted-foreground'>
						<div className='mb-2 flex items-center gap-2'>
							<Info className='size-4' aria-hidden='true' />
							<SectionLabel>Ineligible</SectionLabel>
						</div>
						<p>{ineligibleReason}</p>
					</div>
				)}

				{isCurrentUserChallenger && duel.status !== "matched" ? (
					<Button
						variant='outline'
						className='w-full uppercase tracking-wider'
						onClick={onCancelDuel}
						disabled={isCancelling}
					>
						{isCancelling ? (
							<Spinner />
						) : (
							<Ban className='size-4' />
						)}
						Cancel duel
					</Button>
				) : null}

				<StickyActionBar>
					<Button
						className={cn(
							"w-full bg-linear-to-r from-primary to-accent uppercase tracking-wider shadow-lg shadow-primary/20",
							(!eligible ||
								isJoining ||
								isCurrentUserChallenger) &&
								"shadow-none cursor-not-allowed",
						)}
						onClick={onCommitEscrow}
						disabled={
							!eligible || isJoining || isCurrentUserChallenger
						}
					>
						{isJoining ? (
							<Spinner />
						) : (
							<Swords className='size-4' />
						)}
						Commit {fmtPts(duel.stake_amount)} pts to Escrow
					</Button>
				</StickyActionBar>
			</>
		);
	};

	const renderMatched = () => {
		const resultReady = !!(
			duel.resolved?.has_result || duel.status === "resolved"
		);

		return (
			<>
				<StatusBanner
					icon={
						<Lock
							className='size-5 text-primary'
							aria-hidden='true'
						/>
					}
					title='Duel Locked'
					subtitle='Picks revealed - opponent matched.'
					variant='primary'
				/>

				<EscrowCard
					amount={duel.stake_amount}
					lines={[
						"Both duel stakes are now held until the prediction resolves.",
					]}
				/>

				<VsMatchup
					leftName={duel.challenger_username}
					rightName={duel.matched_opponent_username}
					leftPickLabel={challengerPickLabel}
					rightPickLabel={opponentPickLabel}
					leftRing={currentUserId === duel.challenger_player_id}
					rightRing={
						currentUserId === duel.matched_opponent_player_id
					}
					stake={duel.stake_amount}
				/>

				<div className='rounded-2xl border border-border bg-card p-4'>
					<SectionLabel>Challenger Queue</SectionLabel>
					<div className='mt-3 space-y-2'>
						{queueRows.length === 0 ? (
							<div className='rounded-xl border border-dashed border-border bg-secondary/40 p-3 text-sm text-muted-foreground'>
								Queue has been cleared after matching.
							</div>
						) : (
							queueRows.map((row) => {
								const statusClass =
									row.status === "matched"
										? "bg-primary/20 text-primary"
										: row.status === "refunded"
											? "bg-secondary text-muted-foreground"
											: "bg-secondary text-muted-foreground";
								const statusIcon =
									row.status === "matched" ? (
										<Check
											className='size-3'
											aria-hidden='true'
										/>
									) : row.status === "refunded" ? (
										<RotateCw
											className='size-3'
											aria-hidden='true'
										/>
									) : (
										<Hourglass
											className='size-3 animate-pulse'
											aria-hidden='true'
										/>
									);
								return (
									<div
										key={`${row.position}-${row.username}`}
										className='flex items-center gap-2 rounded-xl border border-border bg-secondary/30 p-2'
									>
										<span className='w-9 text-center font-mono text-xs tabular-nums text-muted-foreground'>
											#{row.position}
										</span>
										<DuelAvatarTile
											name={row.username}
											size='sm'
											ring={!!row.is_you}
										/>
										<div className='min-w-0 flex-1'>
											<p className='truncate text-sm font-medium'>
												{row.username}
											</p>
										</div>
										{row.is_you ? (
											<span className='rounded-full border border-border bg-card px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground'>
												You
											</span>
										) : null}
										<span
											className={cn(
												"inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
												statusClass,
											)}
										>
											{statusIcon}
											{row.status}
										</span>
									</div>
								);
							})
						)}
					</div>
				</div>

				<StickyActionBar>
					<Button
						className={cn(
							"w-full uppercase tracking-wider",
							resultReady
								? "bg-linear-to-r from-primary to-accent shadow-lg shadow-primary/20"
								: "bg-secondary text-muted-foreground cursor-not-allowed",
						)}
						disabled={!resultReady}
						onClick={() =>
							navigate(
								`/rooms/${room.code}/predictions/${prediction.id}/duels/${duel.id}`,
							)
						}
					>
						{resultReady ? (
							<Trophy className='size-4' />
						) : (
							<Clock className='size-4' />
						)}
						{resultReady ? "See Result" : "Waiting for result..."}
					</Button>
				</StickyActionBar>
			</>
		);
	};

	const renderResolved = () => {
		const pot = resolvedMeta?.pot_amount ?? inferredPot;

		return (
			<>
				<div className='relative'>
					{showWinBurst ? (
						<div className='pointer-events-none absolute inset-0 overflow-hidden rounded-2xl'>
							<Sparkles
								className='absolute left-6 top-4 size-4 animate-ping text-accent'
								aria-hidden='true'
							/>
							<Sparkles
								className='absolute right-8 top-10 size-3 animate-ping text-primary [animation-delay:180ms]'
								aria-hidden='true'
							/>
							<Sparkles
								className='absolute left-1/2 top-2 size-4 -translate-x-1/2 animate-ping text-win [animation-delay:320ms]'
								aria-hidden='true'
							/>
						</div>
					) : null}
					<StatusBanner
						icon={
							isWin ? (
								<Crown
									className='size-5 text-win'
									aria-hidden='true'
								/>
							) : (
								<Trophy
									className='size-5 text-muted-foreground'
									aria-hidden='true'
								/>
							)
						}
						title={isWin ? "You won the duel" : "Duel resolved"}
						subtitle={
							isWin
								? "Winner payout has been applied."
								: "Outcome is final and payout is settled."
						}
						variant={isWin ? "win" : "neutral"}
						extra={
							<p
								className={cn(
									"font-mono text-4xl font-semibold tabular-nums",
									isWin
										? "text-win"
										: "text-muted-foreground",
								)}
							>
								{signedPts(payoutForCurrentUser)}
							</p>
						}
					/>
				</div>

				<div className='grid grid-cols-2 gap-3'>
					<div
						className={cn(
							"rounded-2xl border p-4 transition-all duration-300",
							isWin
								? "border-win/40 bg-win/10"
								: "border-border bg-card",
						)}
					>
						<SectionLabel>{isWin ? "Winner" : "Lost"}</SectionLabel>
						<div className='mt-2 flex items-center gap-2'>
							<DuelAvatarTile
								name={
									isWin
										? player.username
										: duel.challenger_player_id ===
											  player.id
											? duel.matched_opponent_username
											: duel.challenger_username
								}
								size='md'
								ring={isWin}
							/>
							<div className='min-w-0'>
								<p className='truncate text-sm font-semibold'>
									{isWin
										? "You"
										: duel.challenger_player_id ===
											  player.id
											? duel.matched_opponent_username
											: duel.challenger_username}
								</p>
								<PickChip
									label={
										isWin
											? myPickLabel
											: duel.challenger_player_id ===
												  player.id
												? opponentPickLabel
												: challengerPickLabel
									}
								/>
							</div>
						</div>
					</div>
					<div
						className={cn(
							"rounded-2xl border p-4 transition-all duration-300",
							!isWin
								? "border-win/40 bg-secondary/40"
								: "border-border bg-card",
						)}
					>
						<SectionLabel>{isWin ? "Lost" : "Winner"}</SectionLabel>
						<div className='mt-2 flex items-center gap-2'>
							<DuelAvatarTile
								name={
									isWin
										? duel.challenger_player_id ===
											player.id
											? duel.matched_opponent_username
											: duel.challenger_username
										: player.username
								}
								size='md'
								ring={!isWin}
							/>
							<div className='min-w-0'>
								<p className='truncate text-sm font-semibold'>
									{isWin
										? duel.challenger_player_id ===
											player.id
											? duel.matched_opponent_username
											: duel.challenger_username
										: "You"}
								</p>
								<PickChip
									label={
										isWin
											? duel.challenger_player_id ===
												player.id
												? opponentPickLabel
												: challengerPickLabel
											: myPickLabel
									}
								/>
							</div>
						</div>
					</div>
				</div>

				{/* <StakeBreakdown
					stake={duel.stake_amount}
					fee={duel.fee_amount}
					pot={pot}
					potLabel='Pot won'
				/> */}

				{resolvedMeta?.rivalry_update ? (
					<div className='rounded-2xl border border-border bg-primary/10 p-4 text-sm'>
						<div className='mb-2 flex items-center gap-2 text-primary'>
							<Flame className='size-4' aria-hidden='true' />
							<SectionLabel>Series Update</SectionLabel>
						</div>
						<p className='text-muted-foreground'>
							{resolvedMeta.rivalry_update}
						</p>
					</div>
				) : null}

				{typeof resolvedMeta?.queued_refunded_count === "number" ||
				resolvedMeta?.refund_note ? (
					<div className='rounded-2xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground'>
						<div className='mb-2 flex items-center gap-2'>
							<RotateCw className='size-4' aria-hidden='true' />
							<SectionLabel>Refunds</SectionLabel>
						</div>
						<p>
							{resolvedMeta?.refund_note ??
								`${resolvedMeta?.queued_refunded_count ?? 0} queued players were refunded automatically.`}
						</p>
					</div>
				) : null}

				<StickyActionBar>
					<Button
						variant='outline'
						className='w-full uppercase tracking-wider'
						onClick={onBack}
					>
						<ChevronLeft className='size-4' />
						Back to Duels
					</Button>
				</StickyActionBar>
			</>
		);
	};

	const renderExpired = () => {
		return (
			<>
				<StatusBanner
					icon={
						<Hourglass
							className='size-5 text-muted-foreground'
							aria-hidden='true'
						/>
					}
					title='Duel expired'
					subtitle='No opponent matched before the deadline.'
				/>

				<div className='rounded-2xl border border-border bg-card p-4'>
					<div className='flex items-center justify-between'>
						<SectionLabel>Stake</SectionLabel>
						<span className='font-mono tabular-nums'>
							{fmtPts(duel.stake_amount)} pts
						</span>
					</div>
					<div className='mt-3 flex items-center gap-2 rounded-xl bg-secondary/40 p-3 text-sm text-win'>
						<RotateCw className='size-4' aria-hidden='true' />
						Stake refunded
					</div>
				</div>

				<VsMatchup
					leftName={duel.challenger_username}
					rightName={null}
					leftPickLabel={challengerPickLabel}
					rightPickLabel='No match'
					leftPickHidden
					stake={duel.stake_amount}
					rightEmptyLabel='No match'
				/>

				<StickyActionBar>
					<Button
						variant='outline'
						className='w-full uppercase tracking-wider'
						onClick={onBack}
					>
						<Swords className='size-4' />
						Create a new duel
					</Button>
				</StickyActionBar>
			</>
		);
	};

	const renderCancelled = () => {
		const reason =
			duel.cancellation_reason ??
			"This duel was voided and all held stakes were returned.";

		return (
			<>
				<StatusBanner
					icon={
						<Ban
							className='size-5 text-muted-foreground'
							aria-hidden='true'
						/>
					}
					title='Duel cancelled'
					subtitle={reason}
				/>

				<div className='rounded-2xl border border-border bg-card p-4'>
					<SectionLabel>Refund Summary</SectionLabel>
					<div className='mt-3 flex items-center justify-between rounded-xl bg-secondary/40 p-3'>
						<div className='flex items-center gap-2 text-sm text-muted-foreground'>
							<RotateCw
								className='size-4 text-win'
								aria-hidden='true'
							/>
							Stake returned to participants
						</div>
						<span className='font-mono tabular-nums text-win'>
							{fmtPts(duel.stake_amount)} pts
						</span>
					</div>
				</div>

				<StickyActionBar>
					<Button
						variant='outline'
						className='w-full uppercase tracking-wider'
						onClick={onBack}
					>
						<ChevronLeft className='size-4' />
						Back to Duels
					</Button>
				</StickyActionBar>
			</>
		);
	};

	return (
		<div className='mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col'>
			<div className='flex-1 space-y-4 overflow-y-auto px-4 pb-20 pt-4'>
				{visualState === "join" ? renderJoin() : null}
				{visualState === "matched" ? renderMatched() : null}
				{visualState === "resolved" ? renderResolved() : null}
				{visualState === "expired" ? renderExpired() : null}
				{visualState === "cancelled" ? renderCancelled() : null}
			</div>
		</div>
	);
}
