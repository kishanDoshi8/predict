import {
	AchievementStreakMilestoneActivity,
	DuelCancelledActivity,
	DuelCreatedActivity,
	DuelExpiredActivity,
	DuelMatchedActivity,
	DuelResolvedActivity,
	PredictionCancelledActivity,
	PredictionCreatedActivity,
	PredictionLockedActivity,
	PredictionNoResultActivity,
	PredictionRevealedActivity,
	RoomActivity,
	RoomJoinedActivity,
} from "@/features/activities/types/types";
import { RoomJoinedCard } from "@/features/activities/components/cards/RoomJoinedCard";
import { PredictionCreatedCard } from "@/features/activities/components/cards/PredictionCreatedCard";
import { PredictionLockedCard } from "@/features/activities/components/cards/PredictionLockedCard";
import { PredictionRevealedCard } from "@/features/activities/components/cards/PredictionRevealedCard";
import { PredictionCancelledCard } from "@/features/activities/components/cards/PredictionCancelledCard";
import { PredictionNoResultCard } from "@/features/activities/components/cards/PredictionNoResultCard";
import { DuelCreatedCard } from "@/features/activities/components/cards/DuelCreatedCard";
import { DuelMatchedCard } from "@/features/activities/components/cards/DuelMatchedCard";
import { DuelResolvedCard } from "@/features/activities/components/cards/DuelResolvedCard";
import { DuelCancelledCard } from "@/features/activities/components/cards/DuelCancelledCard";
import { DuelExpiredCard } from "@/features/activities/components/cards/DuelExpiredCard";
import { AchievementStreakMilestoneCard } from "@/features/activities/components/cards/AchievementStreakMilestoneCard";
import { FEATURES } from "@/shared/constants/features";
import { ActivityCardComponentProps } from "@/features/activities/components/cards/types";

type RegistryProps = {
	activity: RoomActivity;
	roomCode: string;
	showSeries?: boolean;
};

type CardFor<TActivity extends RoomActivity> = (
	props: ActivityCardComponentProps<TActivity>,
) => JSX.Element;

type RegistryMap = {
	room_joined: CardFor<RoomJoinedActivity>;
	achievement_streak_milestone: CardFor<AchievementStreakMilestoneActivity>;
	prediction_created: CardFor<PredictionCreatedActivity>;
	prediction_locked: CardFor<PredictionLockedActivity>;
	prediction_revealed: CardFor<PredictionRevealedActivity>;
	prediction_cancelled: CardFor<PredictionCancelledActivity>;
	prediction_no_result: CardFor<PredictionNoResultActivity>;
	duel_created: CardFor<DuelCreatedActivity>;
	duel_matched: CardFor<DuelMatchedActivity>;
	duel_resolved: CardFor<DuelResolvedActivity>;
	duel_cancelled: CardFor<DuelCancelledActivity>;
	duel_expired: CardFor<DuelExpiredActivity>;
};

const registry: RegistryMap = {
	room_joined: RoomJoinedCard,
	achievement_streak_milestone: AchievementStreakMilestoneCard,
	prediction_created: PredictionCreatedCard,
	prediction_locked: PredictionLockedCard,
	prediction_revealed: PredictionRevealedCard,
	prediction_cancelled: PredictionCancelledCard,
	prediction_no_result: PredictionNoResultCard,
	duel_created: DuelCreatedCard,
	duel_matched: DuelMatchedCard,
	duel_resolved: DuelResolvedCard,
	duel_cancelled: DuelCancelledCard,
	duel_expired: DuelExpiredCard,
};

// Activity from features that are switched off. Ratings still update in the
// background but aren't shown while the series standings are the one ranking.
function isHiddenActivity(activityType: RoomActivity["activityType"]) {
	if (activityType === "achievement_rating_tier_reached") return true;
	return !FEATURES.duels && activityType.startsWith("duel_");
}

export function ActivityCardRegistry({
	activity,
	roomCode,
	showSeries,
}: Readonly<RegistryProps>) {
	if (isHiddenActivity(activity.activityType)) return null;

	const Card = registry[activity.activityType as keyof RegistryMap] as CardFor<RoomActivity>;

	return <Card activity={activity} roomCode={roomCode} showSeries={showSeries} />;
}
