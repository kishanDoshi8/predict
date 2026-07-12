import { HourglassIcon } from "lucide-react";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import {
	formatActivityTimestamp,
	resolveActivityHref,
} from "@/features/activities/lib/activity";
import { DuelExpiredActivity } from "@/features/activities/types/types";
import { ActivityCardComponentProps } from "@/features/activities/components/cards/types";

export function DuelExpiredCard({
	activity,
	roomCode,
}: Readonly<ActivityCardComponentProps<DuelExpiredActivity>>) {
	const metadata = activity.metadata;
	return (
		<ActivityCard
			tier={activity.activityTier}
			icon={<HourglassIcon className='size-4' />}
			title='Duel expired'
			description={`${metadata.challenger.username}'s duel expired before a match`}
			timestamp={formatActivityTimestamp(activity.createdAt)}
			href={resolveActivityHref(activity, roomCode)}
		/>
	);
}
