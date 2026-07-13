import { XCircleIcon } from "lucide-react";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import {
	formatActivityTimestamp,
	resolveActivityHref,
} from "@/features/activities/lib/activity";
import { DuelCancelledActivity } from "@/features/activities/types/types";
import { ActivityCardComponentProps } from "@/features/activities/components/cards/types";

export function DuelCancelledCard({
	activity,
	roomCode,
}: Readonly<ActivityCardComponentProps<DuelCancelledActivity>>) {
	const metadata = activity.metadata;
	return (
		<ActivityCard
			tier={activity.activityTier}
			icon={<XCircleIcon className='size-4' />}
			typeLabel='Duel'
			tone='danger'
			actorLabel={metadata.challenger.username}
			contextLabel='Cancelled'
			title='Duel cancelled'
			description={`${metadata.challenger.username}'s duel was cancelled`}
			timestamp={formatActivityTimestamp(activity.createdAt)}
			href={resolveActivityHref(activity, roomCode)}
		/>
	);
}
