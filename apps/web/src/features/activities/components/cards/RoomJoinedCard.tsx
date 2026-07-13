import { UserPlusIcon } from "lucide-react";
import { ActivityCard } from "@/features/activities/components/ActivityCard";
import { formatActivityTimestamp } from "@/features/activities/lib/activity";
import { RoomJoinedActivity } from "@/features/activities/types/types";
import { ActivityCardComponentProps } from "@/features/activities/components/cards/types";

export function RoomJoinedCard({
	activity,
}: Readonly<ActivityCardComponentProps<RoomJoinedActivity>>) {
	return (
		<ActivityCard
			tier={activity.activityTier}
			icon={<UserPlusIcon className='size-4' />}
			typeLabel='Member'
			tone='member'
			actorLabel={activity.metadata.member.username}
			title={`${activity.metadata.member.username} joined the room`}
			timestamp={formatActivityTimestamp(activity.createdAt)}
		/>
	);
}
