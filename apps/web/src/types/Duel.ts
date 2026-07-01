export type DuelStatus =
	| "created"
	| "queued"
	| "matched"
	| "resolved"
	| "cancelled"
	| "expired";

export interface Duel {
	id: string;
	prediction_id: string;
	challenger_player_id: string;
	challenger_bet_id: string;
	stake_amount: number;
	fee_amount: number;
	status: DuelStatus;
	matched_opponent_player_id: string | null;
	matched_opponent_bet_id: string | null;
	created_at: string;
	matched_at: string | null;
	resolved_at: string | null;
	queue_count: number;
}

export interface DuelSummary {
	activeDuelsCount: number;
	minStake: number | null;
	maxStake: number | null;
	queuePlayersCount: number;
	openDuelsAvailable: boolean;
}
