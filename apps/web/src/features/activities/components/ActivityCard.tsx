import { ReactNode } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/shared/lib/utils";

type ActivityCardProps = {
	tier: 1 | 2 | 3;
	icon: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	summary?: ReactNode;
	timestamp: string;
	href?: string | null;
};

const TIER_STYLES: Record<1 | 2 | 3, string> = {
	1: "border-primary/30 bg-primary/5",
	2: "border-border bg-card",
	3: "border-border/70 bg-muted/30",
};

export function ActivityCard({
	tier,
	icon,
	title,
	description,
	summary,
	timestamp,
	href,
}: Readonly<ActivityCardProps>) {
	const body = (
		<div
			className={cn(
				"relative rounded-2xl border px-4 py-3",
				TIER_STYLES[tier],
				href ? "pr-10" : undefined,
			)}
		>
			<div className='flex items-start gap-3'>
				<div className='mt-0.5 shrink-0 text-primary'>{icon}</div>
				<div className='min-w-0 flex-1'>
					<p className='text-sm font-semibold text-foreground'>{title}</p>
					{description ? (
						<p className='mt-1 text-sm text-muted-foreground'>
							{description}
						</p>
					) : null}
					{summary ? (
						<div className='mt-2 text-xs text-muted-foreground'>
							{summary}
						</div>
					) : null}
					<p className='mt-2 text-xs text-muted-foreground'>{timestamp}</p>
				</div>
			</div>

			{href ? (
				<ChevronRightIcon className='absolute bottom-3 right-3 size-4 text-muted-foreground' />
			) : null}
		</div>
	);

	if (!href) {
		return body;
	}

	return (
		<Link to={href} className='block transition-transform active:scale-[0.99]'>
			{body}
		</Link>
	);
}
