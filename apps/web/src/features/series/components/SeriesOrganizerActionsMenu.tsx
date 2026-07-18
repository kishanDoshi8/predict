import type { Series } from "@/features/series/types/series";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@/shared/ui";
import { SettingsIcon } from "lucide-react";

type SeriesOrganizerActionsMenuProps = {
	series: Series;
	isPending: boolean;
	onEdit: () => void;
	onActivate: () => void;
	onComplete: () => void;
	onArchive: () => void;
};

export function SeriesOrganizerActionsMenu({
	series,
	isPending,
	onEdit,
	onActivate,
	onComplete,
	onArchive,
}: Readonly<SeriesOrganizerActionsMenuProps>) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant='ghost' size='icon'>
					<SettingsIcon className='size-5' />
				</Button>
			</PopoverTrigger>
			<PopoverContent align='end' className='w-44 p-2'>
				<div className='space-y-1'>
					<Button
						variant='ghost'
						size='sm'
						className='w-full justify-start'
						onClick={onEdit}
						disabled={isPending}
					>
						Edit
					</Button>
					{series.status === "draft" ? (
						<Button
							variant='ghost'
							size='sm'
							className='w-full justify-start'
							onClick={onActivate}
							disabled={isPending}
						>
							Activate
						</Button>
					) : null}
					{series.status === "active" ? (
						<Button
							variant='ghost'
							size='sm'
							className='w-full justify-start'
							onClick={onComplete}
							disabled={isPending}
						>
							Mark complete
						</Button>
					) : null}
					{series.status === "completed" ? (
						<Button
							variant='ghost'
							size='sm'
							className='w-full justify-start'
							onClick={onArchive}
							disabled={isPending}
						>
							Archive
						</Button>
					) : null}
				</div>
			</PopoverContent>
		</Popover>
	);
}
