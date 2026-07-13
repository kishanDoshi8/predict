import { ReactNode } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui";

type ActivityTone =
	| "neutral"
	| "member"
	| "prediction"
	| "duel"
	| "success"
	| "warning"
	| "danger";

type ActivityTier = 1 | 2 | 3;

type ActivityCardProps = {
	tier: ActivityTier;
	icon: ReactNode;
	typeLabel: string;
	tone?: ActivityTone;
	actorLabel?: ReactNode;
	contextLabel?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	summary?: ReactNode;
	timestamp: string;
	href?: string | null;
};

const TIER_STYLES: Record<ActivityTier, string> = {
	1: "border-activity/35 bg-activity/10",
	2: "border-border bg-card",
	3: "border-border/70 bg-muted/30",
};

const TIER_LABELS: Record<ActivityTier, string> = {
	1: "High",
	2: "Normal",
	3: "Low",
};

const TIER_BADGE_STYLES: Record<ActivityTier, string> = {
	1: "border-activity/30 bg-activity/15 text-activity",
	2: "border-border bg-background/80 text-foreground/80",
	3: "border-border/70 bg-muted/70 text-muted-foreground",
};

const TONE_STYLES: Record<
	ActivityTone,
	{
		shell: string;
		icon: string;
		typeBadge: string;
		summary: string;
		openPill: string;
	}
> = {
	neutral: {
		shell: "",
		icon: "border-border/60 bg-background/70 text-activity",
		typeBadge: "border-border bg-secondary text-secondary-foreground",
		summary: "border-border/60 bg-muted/35 text-foreground/90",
		openPill: "border-border/70 bg-background/70 text-muted-foreground",
	},
	member: {
		shell: "bg-win/5 border-win/25",
		icon: "border-win/35 bg-win/15 text-win",
		typeBadge: "border-win/30 bg-win/15 text-win",
		summary: "border-win/25 bg-win/10 text-foreground/90",
		openPill: "border-win/30 bg-win/10 text-win",
	},
	prediction: {
		shell: "bg-accent/10 border-accent/30",
		icon: "border-accent/40 bg-accent/20 text-accent-foreground",
		typeBadge: "border-accent/35 bg-accent/20 text-accent-foreground",
		summary: "border-accent/30 bg-accent/15 text-foreground/90",
		openPill: "border-accent/35 bg-accent/15 text-foreground/90",
	},
	duel: {
		shell: "bg-activity/10 border-activity/30",
		icon: "border-activity/35 bg-activity/18 text-activity",
		typeBadge: "border-activity/30 bg-activity/15 text-activity",
		summary: "border-activity/25 bg-activity/12 text-foreground/90",
		openPill: "border-activity/30 bg-activity/12 text-activity",
	},
	success: {
		shell: "bg-win/6 border-win/30",
		icon: "border-win/35 bg-win/15 text-win",
		typeBadge: "border-win/30 bg-win/15 text-win",
		summary: "border-win/30 bg-win/10 text-foreground/90",
		openPill: "border-win/30 bg-win/10 text-win",
	},
	warning: {
		shell: "bg-accent/10 border-accent/35",
		icon: "border-accent/40 bg-accent/20 text-accent-foreground",
		typeBadge: "border-accent/35 bg-accent/20 text-accent-foreground",
		summary: "border-accent/35 bg-accent/15 text-foreground/90",
		openPill: "border-accent/35 bg-accent/15 text-foreground/90",
	},
	danger: {
		shell: "bg-destructive/5 border-destructive/30",
		icon: "border-destructive/35 bg-destructive/15 text-destructive",
		typeBadge: "border-destructive/30 bg-destructive/15 text-destructive",
		summary: "border-destructive/30 bg-destructive/10 text-foreground/90",
		openPill: "border-destructive/30 bg-destructive/10 text-destructive",
	},
};

export function ActivityCard({
	tier,
	icon,
	typeLabel,
	tone = "neutral",
	actorLabel,
	contextLabel,
	title,
	description,
	summary,
	timestamp,
	href,
}: Readonly<ActivityCardProps>) {
	const hasSummary = Boolean(summary);
	const hasDescription = Boolean(description);
	const hasMeta = Boolean(actorLabel || contextLabel);
	const toneStyles = TONE_STYLES[tone];

	const body = (
		<div
			className={cn(
				"rounded-2xl border px-4 py-3.5 transition-colors duration-200 motion-reduce:transition-none",
				TIER_STYLES[tier],
				toneStyles.shell,
				href ? "shadow-xs" : undefined,
			)}
		>
			<div className='flex items-start gap-3.5'>
				<div
					className={cn(
						"mt-0.5 shrink-0 rounded-lg border p-2",
						toneStyles.icon,
					)}
				>
					{icon}
				</div>
				<div className='min-w-0 flex-1'>
					<div className='flex flex-wrap items-center gap-1.5'>
						<Badge
							variant='outline'
							className={cn(
								"h-5 rounded-full px-2 text-[11px] font-semibold",
								toneStyles.typeBadge,
							)}
						>
							{typeLabel}
						</Badge>
						<Badge
							variant='outline'
							className={cn(
								"h-5 rounded-full px-2 text-[11px] font-medium",
								TIER_BADGE_STYLES[tier],
							)}
						>
							{TIER_LABELS[tier]}
						</Badge>
					</div>
					<p className='mt-2 text-base font-semibold leading-snug text-foreground'>
						{title}
					</p>
					{hasDescription ? (
						<p className='mt-1.5 line-clamp-2 text-sm leading-5 text-muted-foreground'>
							{description}
						</p>
					) : null}
					{hasSummary ? (
						<div
							className={cn(
								"mt-2.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium leading-4",
								toneStyles.summary,
							)}
						>
							{summary}
						</div>
					) : null}
					<div
						className={cn(
							"flex items-end justify-between gap-2",
							hasDescription || hasSummary || hasMeta
								? "mt-2.5"
								: "mt-1.5",
						)}
					>
						<div className='min-w-0 flex flex-wrap items-center gap-1.5'>
							{actorLabel ? (
								<Badge
									variant='outline'
									className='h-5 max-w-full rounded-full border-border/70 bg-background/70 px-2 text-[11px] font-medium text-foreground/80'
								>
									<span className='truncate'>
										{actorLabel}
									</span>
								</Badge>
							) : null}
							{contextLabel ? (
								<Badge
									variant='outline'
									className='h-5 max-w-full rounded-full border-border/70 bg-muted/60 px-2 text-[11px] font-medium text-muted-foreground'
								>
									<span className='truncate'>
										{contextLabel}
									</span>
								</Badge>
							) : null}
						</div>
						<div className='shrink-0 text-xs font-medium text-muted-foreground'>
							{timestamp}
						</div>
					</div>
				</div>
			</div>
			{href ? (
				<div className='mt-2 flex justify-end'>
					<span
						className={cn(
							"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
							toneStyles.openPill,
						)}
					>
						Open
						<ChevronRightIcon className='size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none' />
					</span>
				</div>
			) : null}
		</div>
	);

	if (!href) {
		return body;
	}

	return (
		<Link
			to={href}
			className='group block rounded-2xl transition-transform duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 motion-reduce:transition-none'
		>
			{body}
		</Link>
	);
}
