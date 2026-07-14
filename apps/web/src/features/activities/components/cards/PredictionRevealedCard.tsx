import { TrophyIcon } from "lucide-react";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import {
	formatActivityTimestamp,
	formatPoints,
	resolveActivityHref,
} from "@/features/activities/lib/activity";
import { PredictionRevealedActivity } from "@/features/activities/types/types";
import { ActivityCardComponentProps } from "@/features/activities/components/cards/types";

export function PredictionRevealedCard({
	activity,
	roomCode,
}: Readonly<ActivityCardComponentProps<PredictionRevealedActivity>>) {
	const metadata = activity.metadata;
	const winnerLabel = metadata.winningOptionLabel ?? "Winner decided";
	return (
		<ActivityCard
			tier={activity.activityTier}
			icon={<TrophyIcon className='size-4' />}
			typeLabel='Prediction'
			tone='success'
			contextLabel='Resolved'
			title={metadata.title}
			description='Prediction resolved'
			summary={`${winnerLabel} · ${formatPoints(metadata.totalWagered)} pts pool`}
			timestamp={formatActivityTimestamp(activity.createdAt)}
			href={resolveActivityHref(activity, roomCode)}
		/>
	);
}
