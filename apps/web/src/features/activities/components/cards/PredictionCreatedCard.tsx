import { SparklesIcon } from "lucide-react";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import {
	formatActivityTimestamp,
	formatPoints,
	resolveActivityHref,
} from "@/features/activities/lib/activity";
import { PredictionCreatedActivity } from "@/features/activities/types/types";
import { ActivityCardComponentProps } from "@/features/activities/components/cards/types";

export function PredictionCreatedCard({
	activity,
	roomCode,
}: Readonly<ActivityCardComponentProps<PredictionCreatedActivity>>) {
	const metadata = activity.metadata;
	return (
		<ActivityCard
			tier={activity.activityTier}
			icon={<SparklesIcon className='size-4' />}
			typeLabel='Prediction'
			tone='prediction'
			contextLabel='Created'
			title='Prediction created'
			description={metadata.title}
			summary={`${metadata.totalBets} bets · ${formatPoints(metadata.totalWagered)} pts wagered`}
			timestamp={formatActivityTimestamp(activity.createdAt)}
			href={resolveActivityHref(activity, roomCode)}
		/>
	);
}
