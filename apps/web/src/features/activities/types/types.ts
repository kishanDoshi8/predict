export type ActivityType =
	| "room_joined"
	| "prediction_created"
	| "prediction_locked"
	| "prediction_revealed"
	| "prediction_cancelled"
	| "prediction_no_result"
	| "duel_created"
	| "duel_matched"
	| "duel_resolved"
	| "duel_cancelled"
	| "duel_expired";

export type ActivityTier = 1 | 2 | 3;

export type ActivityFilter =
	| "all"
	| "predictions"
	| "duels"
	| "members"
	| "achievements";

export type ActivityClickAction =
	| {
			type: "prediction";
			predictionId: string;
	  }
	| {
			type: "duel";
			predictionId: string;
			duelId: string;
	  };

export type ActivityPlayer = {
	id: string;
	username: string;
};

export type PredictionActivityOptionTotal = {
	optionId: string;
	label: string;
	totalBet: number;
	displayOrder: number;
};

export type PredictionActivityMetadata = {
	predictionId: string;
	title: string;
	status: "draft" | "locked" | "revealed" | "cancelled" | "no_result";
	deadline: string;
	resolvedAt: string | null;
	winningOptionId: string | null;
	winningOptionLabel: string | null;
	noResultReason: string | null;
	totalBets: number;
	totalWagered: number;
	optionTotals: PredictionActivityOptionTotal[];
};

export type DuelActivityMetadata = {
	duelId: string;
	predictionId: string;
	predictionTitle: string;
	status: "created" | "queued" | "matched" | "resolved" | "cancelled" | "expired";
	challenger: ActivityPlayer;
	opponent: ActivityPlayer | null;
	winner: ActivityPlayer | null;
	stakeAmount: number;
	payout: number | null;
	createdAt: string;
	matchedAt: string | null;
	resolvedAt: string | null;
};

export type RoomJoinedMetadata = {
	member: ActivityPlayer;
};

export type RoomActivityBase<
	TType extends ActivityType,
	TMetadata,
> = {
	id: string;
	activityType: TType;
	activityTier: ActivityTier;
	metadata: TMetadata;
	clickAction: ActivityClickAction | null;
	createdAt: string;
};

export type RoomJoinedActivity = RoomActivityBase<
	"room_joined",
	RoomJoinedMetadata
>;

export type PredictionCreatedActivity = RoomActivityBase<
	"prediction_created",
	PredictionActivityMetadata
>;
export type PredictionLockedActivity = RoomActivityBase<
	"prediction_locked",
	PredictionActivityMetadata
>;
export type PredictionRevealedActivity = RoomActivityBase<
	"prediction_revealed",
	PredictionActivityMetadata
>;
export type PredictionCancelledActivity = RoomActivityBase<
	"prediction_cancelled",
	PredictionActivityMetadata
>;
export type PredictionNoResultActivity = RoomActivityBase<
	"prediction_no_result",
	PredictionActivityMetadata
>;

export type DuelCreatedActivity = RoomActivityBase<
	"duel_created",
	DuelActivityMetadata
>;
export type DuelMatchedActivity = RoomActivityBase<
	"duel_matched",
	DuelActivityMetadata
>;
export type DuelResolvedActivity = RoomActivityBase<
	"duel_resolved",
	DuelActivityMetadata
>;
export type DuelCancelledActivity = RoomActivityBase<
	"duel_cancelled",
	DuelActivityMetadata
>;
export type DuelExpiredActivity = RoomActivityBase<
	"duel_expired",
	DuelActivityMetadata
>;

export type RoomActivity =
	| RoomJoinedActivity
	| PredictionCreatedActivity
	| PredictionLockedActivity
	| PredictionRevealedActivity
	| PredictionCancelledActivity
	| PredictionNoResultActivity
	| DuelCreatedActivity
	| DuelMatchedActivity
	| DuelResolvedActivity
	| DuelCancelledActivity
	| DuelExpiredActivity;

export type RoomActivitiesPage = {
	items: RoomActivity[];
	next_cursor_created_at: string | null;
	next_cursor_id: string | null;
	has_more: boolean;
};
