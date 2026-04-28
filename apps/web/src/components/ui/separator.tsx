import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

interface SeparatorProps extends React.ComponentProps<
	typeof SeparatorPrimitive.Root
> {
	label?: string;
	labelClassName?: string;
}

function Separator({
	className,
	orientation = "horizontal",
	decorative = true,
	label,
	labelClassName,
	children, // In case you want to pass something other than a string
	...props
}: SeparatorProps) {
	const content = label || children;

	// If there's no text/content, just return the standard Radix separator
	if (!content || orientation === "vertical") {
		return (
			<SeparatorPrimitive.Root
				data-slot='separator'
				decorative={decorative}
				orientation={orientation}
				className={cn(
					"bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
					className,
				)}
				{...props}
			/>
		);
	}

	return (
		<div
			className={cn(
				"flex items-center w-full text-sm text-muted-foreground",
				className,
			)}
		>
			{/* Left Line */}
			<SeparatorPrimitive.Root
				decorative={decorative}
				orientation='horizontal'
				className='bg-border h-px flex-1'
				{...props}
			/>

			{/* Text Label */}
			<span
				className={cn("px-3 font-fira tracking-wider", labelClassName)}
			>
				{content}
			</span>

			{/* Right Line */}
			<SeparatorPrimitive.Root
				decorative={decorative}
				orientation='horizontal'
				className='bg-border h-px flex-1'
				{...props}
			/>
		</div>
	);
}

export { Separator };
