export type DuelStatus =
	| "created"
	| "queued"
	| "matched"
	| "resolved"
	| "cancelled"
	| "expired";

export type DuelCurrentPlayerState =
	| "none"
	| "creator"
	| "queued"
	| "matched"
	| "winner"
	| "loser";

export interface MinimalPlayer {
	id: string;
	username: string;
}

export interface RivalrySummary {
	totalDuels: number;
	wins: number;
	losses: number;
	netPoints: number;
}

export interface Duel {
	id: string;
	status: DuelStatus;
	challenger: MinimalPlayer;
	opponent: MinimalPlayer | null;
	stakeAmount: number;
	feeAmount: number;
	totalPot: number;
	queueCount: number;
	queuedPlayers: MinimalPlayer[];
	currentPlayerState: DuelCurrentPlayerState;
	currentPlayerQueued: boolean;
	totalReserved: number;
	rivalry: RivalrySummary | null;
	winner: MinimalPlayer | null;
	payout: number | null;
	createdAt: string;
	matchedAt: string | null;
	resolvedAt: string | null;
}

export interface DuelSummary {
	totalDuels: number;
	activeDuels: number;
	matchedDuels: number;
	resolvedDuels: number;
	totalStake: number;
	totalEscrow: number;
	largestStake: number | null;
	medianStake: number | null;
	uniqueParticipants: number;
	queueEntries: number;
	currentPlayerHasCreatedDuel: boolean;
	currentPlayerCreatedDuelId: string | null;
	currentPlayerQueuedCount: number;
	currentPlayerCanCreate: boolean;
}
