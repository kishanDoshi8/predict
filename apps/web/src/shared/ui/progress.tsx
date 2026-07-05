import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";

import { cn } from "@/shared/lib/utils";

function Progress({
	className,
	indicatorBgClassName,
	value,
	...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
	indicatorBgClassName?: string;
}) {
	return (
		<ProgressPrimitive.Root
			data-slot='progress'
			className={cn(
				"bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
				className,
			)}
			{...props}
		>
			<ProgressPrimitive.Indicator
				data-slot='progress-indicator'
				className={cn(
					"h-full w-full flex-1 transition-all rounded-full",
					indicatorBgClassName || "bg-linear-to-r from-primary to-accent ",
				)}
				style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
			/>
		</ProgressPrimitive.Root>
	);
}

export { Progress };
