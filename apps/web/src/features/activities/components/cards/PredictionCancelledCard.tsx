import { BanIcon } from "lucide-react";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import {
	formatActivityTimestamp,
	resolveActivityHref,
} from "@/features/activities/lib/activity";
import { PredictionCancelledActivity } from "@/features/activities/types/types";
import { ActivityCardComponentProps } from "@/features/activities/components/cards/types";

export function PredictionCancelledCard({
	activity,
	roomCode,
}: Readonly<ActivityCardComponentProps<PredictionCancelledActivity>>) {
	const metadata = activity.metadata;
	return (
		<ActivityCard
			tier={activity.activityTier}
			icon={<BanIcon className='size-4' />}
			typeLabel='Prediction'
			tone='danger'
			contextLabel='Cancelled'
			title={metadata.title}
			description='Prediction cancelled'
			summary={metadata.noResultReason ?? "All bets were refunded."}
			timestamp={formatActivityTimestamp(activity.createdAt)}
			href={resolveActivityHref(activity, roomCode)}
		/>
	);
}
