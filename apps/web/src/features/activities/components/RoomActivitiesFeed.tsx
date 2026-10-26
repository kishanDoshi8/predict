import { AlertCircleIcon } from "lucide-react";
import { ActivityFeedSkeleton } from "@/features/activities/components/ActivityCardSkeleton";
import { ActivityCardRegistry } from "@/features/activities/components/ActivityCardRegistry";
import { RoomActivity } from "@/features/activities/types/types";

type RoomActivitiesFeedProps = {
	activities: RoomActivity[];
	roomCode: string;
	isLoading: boolean;
	isError: boolean;
	errorMessage?: string;
	emptyMessage?: string;
	showSeries?: boolean;
};

export function RoomActivitiesFeed({
	activities,
	roomCode,
	isLoading,
	isError,
	errorMessage,
	emptyMessage,
	showSeries,
}: Readonly<RoomActivitiesFeedProps>) {
	if (isLoading) {
		return <ActivityFeedSkeleton />;
	}

	if (isError) {
		return (
			<div className='rounded-2xl border border-destructive/30 bg-destructive/5 p-4'>
				<p className='flex items-center gap-2 text-sm font-medium text-destructive'>
					<AlertCircleIcon className='size-4' />
					Could not load activities
				</p>
				<p className='mt-1 text-sm text-muted-foreground'>
					{errorMessage ?? "Please try again in a moment."}
				</p>
			</div>
		);
	}

	if (activities.length === 0) {
		return (
			<div className='rounded-2xl border border-dashed p-8 text-center'>
				<p className='text-3xl'>🗒️</p>
				<p className='mt-2 text-sm text-muted-foreground'>
					{emptyMessage ?? "No room activities yet."}
				</p>
			</div>
		);
	}

	return (
		<div className='space-y-3'>
			{activities.map((activity) => (
				<ActivityCardRegistry
					key={activity.id}
					activity={activity}
					roomCode={roomCode}
					showSeries={showSeries}
				/>
			))}
		</div>
	);
}
