import type { RoomMemberMilestone } from "@/shared/lib/api";
import { getMilestoneVisual } from "@/shared/lib/seriesRecognitionVisuals";
import { Skeleton } from "@/shared/ui";

const MAX_SHOWN = 6;

type Props = {
	milestones: RoomMemberMilestone[];
	isLoading: boolean;
};

// Career milestones under the trophies: quiet chips, newest first. They are
// personal bars, so they stay neutral and never compete with trophy colors.
export function MilestoneRow({ milestones, isLoading }: Readonly<Props>) {
	if (isLoading) {
		return <Skeleton aria-hidden='true' className='h-6 w-40 rounded-full' />;
	}
	if (milestones.length === 0) return null;

	const shown = milestones.slice(0, MAX_SHOWN);
	const hidden = milestones.length - shown.length;

	return (
		<ul aria-label='Milestones' className='flex flex-wrap gap-1.5'>
			{shown.map((milestone) => {
				const visual = getMilestoneVisual(milestone.milestone_type);
				return (
					<li
						key={milestone.id}
						title={visual.description}
						className='flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground'
					>
						<visual.Icon aria-hidden='true' className='size-3.5 text-foreground/70' />
						{visual.label}
					</li>
				);
			})}
			{hidden > 0 ? (
				<li className='px-1 py-0.5 text-xs text-muted-foreground'>+{hidden}</li>
			) : null}
		</ul>
	);
}
