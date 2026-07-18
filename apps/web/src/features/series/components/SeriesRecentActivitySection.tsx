import { ActivityCardRegistry } from "@/features/activities/components";
import type { RoomActivity } from "@/features/activities/types/types";
import { Skeleton } from "@/shared/ui";

type SeriesRecentActivitySectionProps = {
	isLoading: boolean;
	activities: RoomActivity[];
	roomCode: string;
};

export function SeriesRecentActivitySection({
	isLoading,
	activities,
	roomCode,
}: Readonly<SeriesRecentActivitySectionProps>) {
	let content: React.ReactNode;

	if (isLoading) {
		content = (
			<div className='space-y-2'>
				<Skeleton className='h-24 w-full rounded-2xl' />
				<Skeleton className='h-24 w-full rounded-2xl' />
			</div>
		);
	} else if (activities.length === 0) {
		content = (
			<p className='text-sm text-muted-foreground'>
				No recent activity for this series yet.
			</p>
		);
	} else {
		content = (
			<div className='space-y-2'>
				{activities.map((activity) => (
					<ActivityCardRegistry
						key={activity.id}
						activity={activity}
						roomCode={roomCode}
					/>
				))}
			</div>
		);
	}

	return (
		<section className='space-y-3'>
			<h3 className='text-sm font-semibold uppercase text-muted-foreground'>
				Recent activity
			</h3>
			{content}
		</section>
	);
}
