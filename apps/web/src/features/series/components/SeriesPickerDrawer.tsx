import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { CheckIcon, PlusIcon, TrophyIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCurrentSeries } from "@/features/series/hooks/wallets";
import { SeriesStatusBadge } from "./SeriesStatusBadge";

type Props = {
	roomId: string;
	roomCode: string;
	isOrganizer: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

// Picks the series the whole room view follows: points, Home, Standings,
// History and Activity.
export function SeriesPickerDrawer({
	roomId,
	roomCode,
	isOrganizer,
	open,
	onOpenChange,
}: Readonly<Props>) {
	const navigate = useNavigate();
	const { currentSeriesId, setCurrentSeriesId, seriesOptions } =
		useCurrentSeries(roomId);

	const go = (path: string) => {
		onOpenChange(false);
		navigate(path);
	};

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>Series</DrawerTitle>
					<DrawerDescription>
						Points, standings and history follow the series you
						pick.
					</DrawerDescription>
				</DrawerHeader>

				<ul className='flex flex-col gap-1 px-4 pb-2 max-h-[50vh] overflow-y-auto'>
					{seriesOptions.length === 0 ? (
						<li className='py-6 text-center text-sm text-muted-foreground'>
							No series yet.
						</li>
					) : null}
					{seriesOptions.map((series) => {
						const isCurrent = series.id === currentSeriesId;
						return (
							<li key={series.id}>
								<button
									type='button'
									onClick={() => {
										setCurrentSeriesId(series.id);
										onOpenChange(false);
									}}
									className={cn(
										"w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
										isCurrent
											? "bg-primary/10 text-foreground"
											: "hover:bg-accent/20",
									)}
									aria-current={isCurrent ? "true" : undefined}
								>
									<span className='flex-1 min-w-0 truncate font-medium'>
										{series.title}
									</span>
									<SeriesStatusBadge status={series.status} />
									<CheckIcon
										className={cn(
											"size-4 shrink-0 text-primary",
											!isCurrent && "invisible",
										)}
									/>
								</button>
							</li>
						);
					})}
				</ul>

				<div className='flex flex-col gap-1 border-t px-4 py-3'>
					{isOrganizer ? (
						<button
							type='button'
							onClick={() => go(`/rooms/${roomCode}/series/new`)}
							className='flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-accent/20'
						>
							<PlusIcon className='size-4' />
							Start a new series
						</button>
					) : null}
					<button
						type='button'
						onClick={() => go(`/rooms/${roomCode}/series`)}
						className='flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-accent/20'
					>
						<TrophyIcon className='size-4' />
						All series and past champions
					</button>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
