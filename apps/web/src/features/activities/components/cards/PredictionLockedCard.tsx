import { LockIcon } from "lucide-react";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import {
	formatActivityTimestamp,
	formatPoints,
	resolveActivityHref,
} from "@/features/activities/lib/activity";
import { PredictionLockedActivity } from "@/features/activities/types/types";
import { ActivityCardComponentProps } from "@/features/activities/components/cards/types";

export function PredictionLockedCard({
	activity,
	roomCode,
}: Readonly<ActivityCardComponentProps<PredictionLockedActivity>>) {
	const metadata = activity.metadata;
	return (
		<ActivityCard
			tier={activity.activityTier}
			icon={<LockIcon className='size-4' />}
			typeLabel='Prediction'
			tone='warning'
			contextLabel='Locked'
			title='Prediction locked'
			description={metadata.title}
			summary={`${metadata.totalBets} bets · ${formatPoints(metadata.totalWagered)} pts wagered`}
			timestamp={formatActivityTimestamp(activity.createdAt)}
			href={resolveActivityHref(activity, roomCode)}
		/>
	);
}
