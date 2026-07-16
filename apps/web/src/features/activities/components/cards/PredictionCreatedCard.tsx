import { SparklesIcon } from "lucide-react";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import {
	formatActivityTimestamp,
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
			title={metadata.title}
			description='Prediction created'
			timestamp={formatActivityTimestamp(activity.createdAt)}
			href={resolveActivityHref(activity, roomCode)}
		/>
	);
}
