import type { SeriesSuggestion } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";
import { ChevronUpIcon } from "lucide-react";

type Props = {
	suggestion: SeriesSuggestion;
	onToggle: () => void;
	disabled?: boolean;
};

// Back an idea, or take the vote back. Filled once you've backed it.
export function UpNextVoteButton({
	suggestion,
	onToggle,
	disabled,
}: Readonly<Props>) {
	return (
		<button
			type='button'
			onClick={onToggle}
			disabled={disabled}
			aria-pressed={suggestion.voted_by_me}
			aria-label={`${suggestion.voted_by_me ? "Remove your vote for" : "Vote for"} ${suggestion.title}, ${suggestion.vote_count} ${suggestion.vote_count === 1 ? "vote" : "votes"}`}
			className={cn(
				"flex w-11 shrink-0 flex-col items-center rounded-lg border py-1 tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
				suggestion.voted_by_me
					? "border-primary/50 bg-primary/15 text-primary"
					: "border-border text-muted-foreground hover:text-foreground",
			)}
		>
			<ChevronUpIcon className='size-4' />
			<span className='text-sm font-semibold leading-tight'>
				{suggestion.vote_count}
			</span>
			{/* Says what the button does, so it reads as a vote and not a count. */}
			<span className='text-[10px] font-medium leading-tight'>
				{suggestion.voted_by_me ? "voted" : "vote"}
			</span>
		</button>
	);
}
