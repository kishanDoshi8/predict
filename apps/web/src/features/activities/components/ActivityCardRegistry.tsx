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

type RegistryProps = {
	activity: RoomActivity;
	roomCode: string;
};

type RegistryMap = {
	room_joined: (props: { activity: RoomJoinedActivity; roomCode: string }) => JSX.Element;
	achievement_streak_milestone: (props: {
		activity: AchievementStreakMilestoneActivity;
		roomCode: string;
	}) => JSX.Element;
	prediction_created: (props: { activity: PredictionCreatedActivity; roomCode: string }) => JSX.Element;
	prediction_locked: (props: { activity: PredictionLockedActivity; roomCode: string }) => JSX.Element;
	prediction_revealed: (props: { activity: PredictionRevealedActivity; roomCode: string }) => JSX.Element;
	prediction_cancelled: (props: { activity: PredictionCancelledActivity; roomCode: string }) => JSX.Element;
	prediction_no_result: (props: { activity: PredictionNoResultActivity; roomCode: string }) => JSX.Element;
	duel_created: (props: { activity: DuelCreatedActivity; roomCode: string }) => JSX.Element;
	duel_matched: (props: { activity: DuelMatchedActivity; roomCode: string }) => JSX.Element;
	duel_resolved: (props: { activity: DuelResolvedActivity; roomCode: string }) => JSX.Element;
	duel_cancelled: (props: { activity: DuelCancelledActivity; roomCode: string }) => JSX.Element;
	duel_expired: (props: { activity: DuelExpiredActivity; roomCode: string }) => JSX.Element;
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

export function ActivityCardRegistry({ activity, roomCode }: Readonly<RegistryProps>) {
	if (isHiddenActivity(activity.activityType)) return null;

	const Card = registry[activity.activityType as keyof RegistryMap] as (props: {
		activity: RoomActivity;
		roomCode: string;
	}) => JSX.Element;

	return <Card activity={activity} roomCode={roomCode} />;
}
