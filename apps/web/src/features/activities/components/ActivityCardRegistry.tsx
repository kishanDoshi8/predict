import {
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

type RegistryProps = {
	activity: RoomActivity;
	roomCode: string;
};

type RegistryMap = {
	room_joined: (props: { activity: RoomJoinedActivity; roomCode: string }) => JSX.Element;
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

export function ActivityCardRegistry({ activity, roomCode }: Readonly<RegistryProps>) {
	const Card = registry[activity.activityType] as (props: {
		activity: RoomActivity;
		roomCode: string;
	}) => JSX.Element;

	return <Card activity={activity} roomCode={roomCode} />;
}
