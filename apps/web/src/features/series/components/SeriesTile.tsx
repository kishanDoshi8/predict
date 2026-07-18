import { SeriesStatusBadge } from "@/features/series/components/SeriesStatusBadge";
import type { Series } from "@/features/series/types/series";
import { Field, FieldLabel, Progress } from "@/shared/ui";
import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import { Link } from "react-router-dom";

type SeriesTileProps = {
	series: Series;
	roomCode: string;
};

export function SeriesTile({ series, roomCode }: Readonly<SeriesTileProps>) {
	const completedGames = Math.max(series.completedGames, 0);
	const expectedGames = Math.max(series.expectedGames, 0);
	const progressValue =
		expectedGames > 0
			? Math.min((completedGames / expectedGames) * 100, 100)
			: 0;
	const remainingGames = Math.max(expectedGames - completedGames, 0);
	const isCompleted = series.status === "completed";

	return (
		<Link
			to={`/rooms/${roomCode}/series/${series.id}`}
			className='block rounded-2xl border bg-card p-4 transition-colors hover:border-primary/50'
		>
			<div className='space-y-3'>
				<div className='flex items-start justify-between gap-2'>
					<SeriesStatusBadge status={series.status} />
					<ChevronRightIcon className='size-4 text-muted-foreground' />
				</div>

				<div className='space-y-1'>
					<p className='text-base font-semibold'>{series.title}</p>
					{series.description?.trim() && (
						<p className='truncate text-sm text-muted-foreground'>
							{series.description?.trim()}
						</p>
					)}
				</div>

				<div>
					<Field>
						<FieldLabel>
							<p className='text-xs text-muted-foreground mr-auto'>
								{completedGames} / {expectedGames}
							</p>
							<p>
								{expectedGames > 0
									? Math.min(
											(completedGames / expectedGames) *
												100,
											100,
										)
									: 0}
								%
							</p>
						</FieldLabel>
						<Progress
							value={progressValue}
							indicatorBgClassName={
								isCompleted
									? "bg-win"
									: "bg-linear-to-r from-primary to-accent"
							}
							className={`-mt-1`}
						/>
					</Field>
				</div>

				<div className='text-sm text-muted-foreground'>
					{isCompleted ? (
						<span className='inline-flex items-center gap-1 text-win'>
							<CheckCircle2Icon className='size-4' />
							Completed
						</span>
					) : (
						<span>{remainingGames} games left</span>
					)}
				</div>
			</div>
		</Link>
	);
}
