import { Fragment, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot='skeleton'
			className={cn(
				"animate-pulse rounded-md bg-muted-foreground/35",
				className,
			)}
			{...props}
		/>
	);
}

type SkeletonListProps = {
	count: number;
	className?: string;
	/** Classes for the default bar; ignored when `renderItem` is given. */
	itemClassName?: string;
	/** Draw each placeholder row, usually a row-shaped skeleton. */
	renderItem?: (index: number) => ReactNode;
};

// A stack of placeholders laid out like the list that replaces it. Give it the
// same container classes (gap, spacing) as the real list so nothing shifts.
function SkeletonList({
	count,
	className,
	itemClassName,
	renderItem,
}: Readonly<SkeletonListProps>) {
	return (
		<div data-slot='skeleton-list' aria-hidden='true' className={className}>
			{Array.from({ length: count }, (_, index) => (
				<Fragment key={index}>
					{renderItem ? (
						renderItem(index)
					) : (
						<Skeleton className={itemClassName} />
					)}
				</Fragment>
			))}
		</div>
	);
}

export { Skeleton, SkeletonList };
