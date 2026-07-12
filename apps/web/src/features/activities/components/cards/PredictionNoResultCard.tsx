import { MinusCircleIcon } from "lucide-react";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import {
	formatActivityTimestamp,
	resolveActivityHref,
} from "@/features/activities/lib/activity";
import { PredictionNoResultActivity } from "@/features/activities/types/types";
import { ActivityCardComponentProps } from "@/features/activities/components/cards/types";

export function PredictionNoResultCard({
	activity,
	roomCode,
}: Readonly<ActivityCardComponentProps<PredictionNoResultActivity>>) {
	const metadata = activity.metadata;
	return (
		<ActivityCard
			tier={activity.activityTier}
			icon={<MinusCircleIcon className='size-4' />}
			title='Prediction settled with no result'
			description={metadata.title}
			summary={metadata.noResultReason ?? "All bets were refunded."}
			timestamp={formatActivityTimestamp(activity.createdAt)}
			href={resolveActivityHref(activity, roomCode)}
		/>
	);
}
