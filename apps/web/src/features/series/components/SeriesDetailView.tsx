import { SeriesEditDialog } from "@/features/series/components/SeriesEditDialog";
import { SeriesHallOfFameSection } from "@/features/series/components/SeriesHallOfFameSection";
import { SeriesOverviewCard } from "@/features/series/components/SeriesOverviewCard";
import { ShareStandingsButton } from "@/features/series/components/ShareStandingsButton";
import type {
	LeaderboardEntry,
	PredictionHistoryEntry,
} from "@/features/leaderboard";
import { PredictionHistoryFeed } from "@/features/leaderboard";
import { InPlayPredictions, UserStats } from "@/features/predictions";
import type { Prediction } from "@/features/predictions";
import type { Series } from "@/features/series/types/series";
import type { SeriesAward, SeriesPlacement } from "@/shared/lib/api";
import { Button } from "@/shared/ui";
import { RocketIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRoomContext } from "@/app/layouts/RoomLayout";
import { useCurrentSeries } from "@/features/series/hooks/wallets";

import type { SeriesFormState } from "@/features/series/components/SeriesEditDialog";

type SeriesDetailViewProps = {
	series: Series;
	isOrganizer: boolean;
	isActionPending: boolean;
	isUpdatePending: boolean;
	seriesOpenPredictions: Prediction[];
	seriesCompletedPredictions: PredictionHistoryEntry[];
	isCompletedPredictionsLoading: boolean;
	seriesLeaderboard: LeaderboardEntry[];
	isSeriesLeaderboardLoading: boolean;
	seriesPlacements: SeriesPlacement[];
	isSeriesPlacementsLoading: boolean;
	seriesAwards: SeriesAward[];
	isSeriesAwardsLoading: boolean;
	isEditorOpen: boolean;
	formState: SeriesFormState;
	onEdit: () => void;
	onArchive: () => void;
	onCloseSeries: () => void;
	onNewPrediction: () => void;
	onEditDialogOpenChange: (open: boolean) => void;
	onFormStateChange: (nextState: SeriesFormState) => void;
	onCancelEdit: () => void;
	onSaveEdit: () => void;
};

export function SeriesDetailView({
	series,
	isOrganizer,
	isActionPending,
	isUpdatePending,
	seriesOpenPredictions,
	seriesCompletedPredictions,
	isCompletedPredictionsLoading,
	seriesLeaderboard,
	isSeriesLeaderboardLoading,
	seriesPlacements,
	isSeriesPlacementsLoading,
	seriesAwards,
	isSeriesAwardsLoading,
	isEditorOpen,
	formState,
	onEdit,
	onArchive,
	onCloseSeries,
	onNewPrediction,
	onEditDialogOpenChange,
	onFormStateChange,
	onCancelEdit,
	onSaveEdit,
}: Readonly<SeriesDetailViewProps>) {
	const { room } = useRoomContext();
	const navigate = useNavigate();
	const { setCurrentSeriesId } = useCurrentSeries(room.id);
	const isSeriesClosed =
		series.status === "completed" || series.status === "archived";
	return (
		<div className='mx-auto w-full max-w-md space-y-6 p-4'>
			<SeriesOverviewCard
				series={series}
				isOrganizer={isOrganizer}
				isActionPending={isActionPending}
				onEdit={onEdit}
				onArchive={onArchive}
				onCloseSeries={onCloseSeries}
			/>

			{isSeriesClosed ? (
				<div className='flex justify-end'>
					<ShareStandingsButton series={series} variant='linear' />
				</div>
			) : null}

			{isSeriesClosed ? (
				<SeriesHallOfFameSection
					series={series}
					seriesPlacements={seriesPlacements}
					isSeriesPlacementsLoading={isSeriesPlacementsLoading}
					seriesAwards={seriesAwards}
					isSeriesAwardsLoading={isSeriesAwardsLoading}
				/>
			) : (
				<section className='space-y-3'>
					<h3 className='text-lg font-semibold'>Open predictions</h3>
					<InPlayPredictions
						predictionsOverride={seriesOpenPredictions}
						emptyMessage='No open predictions in this series yet.'
						showSectionHeader={false}
					/>
				</section>
			)}

			<section className='space-y-3'>
				<UserStats
					title='Standings'
					subtitle='Current standings for this series.'
					leaderboardEntriesOverride={seriesLeaderboard}
					isLeaderboardLoadingOverride={isSeriesLeaderboardLoading}
					showSeeAllLink={false}
				/>
				<div className='flex justify-end'>
					<Button
						variant='link'
						className='text-accent px-0'
						onClick={() => {
							// Standings follow the room's series, so switch to this one first.
							setCurrentSeriesId(series.id);
							navigate(`/rooms/${room.code}/leaderboard`);
						}}
					>
						Full standings
					</Button>
				</div>
			</section>

			<section className='space-y-3 mt-8'>
				<h3 className={`text-lg font-semibold`}>
					Completed predictions
				</h3>
				<PredictionHistoryFeed
					entries={seriesCompletedPredictions}
					isLoading={isCompletedPredictionsLoading}
					emptyMessage='Completed predictions for this series will appear here soon.'
				/>
			</section>

			{isOrganizer && series.status !== "completed" ? (
				<div
					className='fixed right-8 z-50 bottom-2'
					style={
						{
							// bottom: "calc(2rem + env(safe-area-inset-bottom))",
						}
					}
				>
					<Button
						type='button'
						variant='linear'
						size='icon-lg'
						className='rounded-full shadow-lg'
						onClick={onNewPrediction}
						aria-label='New prediction'
					>
						<RocketIcon />
					</Button>
				</div>
			) : null}

			<SeriesEditDialog
				open={isEditorOpen}
				onOpenChange={onEditDialogOpenChange}
				isUpdatePending={isUpdatePending}
				pointsLocked={series.hasBets}
				formState={formState}
				onFormStateChange={onFormStateChange}
				onCancel={onCancelEdit}
				onSave={onSaveEdit}
			/>

		</div>
	);
}
