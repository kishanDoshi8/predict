import type { Series } from "@/features/series/types/series";
import { Badge } from "@/shared/ui";
import Dot from "@/shared/ui/dot";

type SeriesStatusBadgeProps = {
	status: Series["status"];
};

export function SeriesStatusBadge({
	status,
}: Readonly<SeriesStatusBadgeProps>) {
	if (status === "active") {
		return (
			<Badge className='bg-primary/20 text-primary'>
				<Dot
					className='mr-1.5 h-2 w-2'
					color='primary'
					animate={true}
				/>
				Active
			</Badge>
		);
	}

	if (status === "completed") {
		return <Badge className='bg-win/20 text-win'>Completed</Badge>;
	}

	if (status === "draft") {
		return <Badge variant='outline'>Draft</Badge>;
	}

	return <Badge variant='secondary'>Archived</Badge>;
}
