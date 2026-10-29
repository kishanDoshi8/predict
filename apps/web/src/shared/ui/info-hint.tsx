import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type Props = {
	/** What the hint explains, for screen readers ("How ranking works"). */
	label: string;
	children: ReactNode;
	className?: string;
};

// A small (i) that explains a game rule in place, without leaving the page.
export function InfoHint({ label, children, className }: Readonly<Props>) {
	return (
		<Popover>
			<PopoverTrigger
				aria-label={label}
				className={cn(
					"inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
					className,
				)}
			>
				<InfoIcon className='size-3.5' />
			</PopoverTrigger>
			<PopoverContent className='w-64 text-sm leading-relaxed'>
				{children}
			</PopoverContent>
		</Popover>
	);
}
