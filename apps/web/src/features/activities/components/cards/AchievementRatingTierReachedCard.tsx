import { SparklesIcon } from "lucide-react";
import { ActivityCardComponentProps } from "@/features/activities/components/cards/types";
import { ActivityPlayerIdentity } from "@/features/activities/components/cards/ActivityPlayerIdentity";
import { formatActivityTimestamp } from "@/features/activities/lib/activity";
import { AchievementRatingTierReachedActivity } from "@/features/activities/types/types";
import { getRatingTierConfig } from "@/features/leaderboard/lib/ratingTierConfig";
import { cn } from "@/shared/lib/utils";

export function AchievementRatingTierReachedCard({
	activity,
}: Readonly<ActivityCardComponentProps<AchievementRatingTierReachedActivity>>) {
	const metadata = activity.metadata;
	const resolvedRating =
		(typeof metadata.rating === "number" ? metadata.rating : null) ??
		metadata.reachedTierMinRating ??
		1500;
	const badge = getRatingTierConfig(resolvedRating);
	const tierLabel = metadata.reachedTierLabel?.trim() || badge.label;
	const isGrandmaster = tierLabel === "Grandmaster";

	return (
		<div className='relative overflow-hidden rounded-3xl border border-activity/35 bg-gradient-to-br from-card via-card to-activity/10 p-4 shadow-[0_16px_40px_-26px_hsl(var(--activity))]'>
			<div className='pointer-events-none absolute -right-14 -top-12 size-36 rounded-full bg-activity/12 blur-3xl' />
			<div className='pointer-events-none absolute -left-10 bottom-0 size-28 rounded-full bg-primary/12 blur-3xl' />

			<div className='relative flex items-start justify-between gap-3'>
				<div className='inline-flex items-center gap-1.5 rounded-full border border-activity/35 bg-activity/10 px-2.5 py-1 text-[11px] font-semibold text-activity'>
					<SparklesIcon className='size-3' />
					Rating Promotion
				</div>
				<span className='shrink-0 text-xs font-medium text-muted-foreground'>
					{formatActivityTimestamp(activity.createdAt)}
				</span>
			</div>

			<div className='relative mt-3 space-y-3'>
				<ActivityPlayerIdentity
					username={metadata.member.username}
					avatarSize='default'
					nameClassName='text-base text-foreground'
				/>
				<p className='text-xl font-semibold leading-tight text-foreground text-wrap-balance'>
					{isGrandmaster ? "👑" : "⭐"}{" "}
					<span className='text-primary'>{metadata.member.username}</span>{" "}
					{isGrandmaster
						? "is now a Grandmaster"
						: `reached ${tierLabel}`}
				</p>
				<div
					className={cn(
						"inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm",
						badge.className,
					)}
				>
					<badge.Icon className='size-4' />
					<span>{tierLabel}</span>
					<span className='opacity-85'>{badge.prefix}</span>
				</div>
				<p className='text-sm text-muted-foreground'>
					{isGrandmaster
						? "Top players aren't born. They're earned."
						: `Reached the ${badge.prefix} rating tier.`}
				</p>
			</div>
		</div>
	);
}
