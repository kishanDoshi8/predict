import { SeriesEditDialog } from "@/features/series/components/SeriesEditDialog";
import { SeriesOverviewCard } from "@/features/series/components/SeriesOverviewCard";
import { SeriesRecentActivitySection } from "@/features/series/components/SeriesRecentActivitySection";
import type {
	LeaderboardEntry,
	PredictionHistoryEntry,
} from "@/features/leaderboard";
import type { RoomActivity } from "@/features/activities/types/types";
import { PredictionHistoryFeed } from "@/features/leaderboard";
import { InPlayPredictions, UserStats } from "@/features/predictions";
import type { Prediction } from "@/features/predictions";
import type { Series } from "@/features/series/types/series";
import { Button } from "@/shared/ui";
import { ChevronLeftIcon, RocketIcon } from "lucide-react";
import { useEffect, useState } from "react";

type SeriesFormState = {
	title: string;
	description: string;
	expectedGames: string;
};

type SeriesDetailViewProps = {
	series: Series;
	roomCode: string;
	isOrganizer: boolean;
	isActionPending: boolean;
	isUpdatePending: boolean;
	seriesOpenPredictions: Prediction[];
	seriesActivities: RoomActivity[];
	isActivityLoading: boolean;
	seriesCompletedPredictions: PredictionHistoryEntry[];
	isCompletedPredictionsLoading: boolean;
	seriesLeaderboard: LeaderboardEntry[];
	isSeriesLeaderboardLoading: boolean;
	isEditorOpen: boolean;
	formState: SeriesFormState;
	onBackToList: () => void;
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
	roomCode,
	isOrganizer,
	isActionPending,
	isUpdatePending,
	seriesOpenPredictions,
	seriesActivities,
	isActivityLoading,
	seriesCompletedPredictions,
	isCompletedPredictionsLoading,
	seriesLeaderboard,
	isSeriesLeaderboardLoading,
	isEditorOpen,
	formState,
	onBackToList,
	onEdit,
	onArchive,
	onCloseSeries,
	onNewPrediction,
	onEditDialogOpenChange,
	onFormStateChange,
	onCancelEdit,
	onSaveEdit,
}: Readonly<SeriesDetailViewProps>) {
	const [compactBackButton, setCompactBackButton] = useState(false);

	useEffect(() => {
		const onScroll = () => {
			setCompactBackButton(window.scrollY > 80);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

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

			<section className='space-y-3'>
				<h3 className={`text-lg font-semibold`}>Open predictions</h3>
				<InPlayPredictions
					predictionsOverride={seriesOpenPredictions}
					emptyMessage='No open predictions in this series yet.'
					showSectionHeader={false}
				/>
			</section>

			<section className='space-y-3'>
				<UserStats
					showControls={false}
					title='Leaderboard'
					subtitle='Current standings for this series.'
					leaderboardEntriesOverride={seriesLeaderboard}
					isLeaderboardLoadingOverride={isSeriesLeaderboardLoading}
					showSeeAllLink={false}
				/>
			</section>

			<SeriesRecentActivitySection
				activities={seriesActivities}
				isLoading={isActivityLoading}
				roomCode={roomCode}
			/>

			<section className='space-y-3'>
				<h3 className={`text-lg font-semibold`}>
					Completed predictions
				</h3>
				<PredictionHistoryFeed
					entries={seriesCompletedPredictions}
					isLoading={isCompletedPredictionsLoading}
					emptyMessage='Completed predictions for this series will appear here soon.'
				/>
			</section>

			{isOrganizer ? (
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
				formState={formState}
				onFormStateChange={onFormStateChange}
				onCancel={onCancelEdit}
				onSave={onSaveEdit}
			/>

			<Button
				variant='secondary'
				onClick={onBackToList}
				aria-label='Back to series'
				className={`sticky bottom-8 left-8 border border-muted-foreground/20 backdrop-blur-sm rounded-2xl
                    transition-all duration-300 ease-out overflow-hidden
                    ${compactBackButton ? "w-10 px-0 justify-center gap-0" : "w-auto px-3 justify-start"}
                `}
				size={compactBackButton ? "icon-lg" : "default"}
			>
				<ChevronLeftIcon className='size-5 shrink-0' />
				<span
					className={`ml-2 whitespace-nowrap transition-all duration-300 ease-out
                        ${compactBackButton ? "max-w-0 w-0 opacity-0 -translate-x-1 ml-0" : "max-w-32 opacity-100 translate-x-0"}
                    `}
				>
					Back to series
				</span>
			</Button>
		</div>
	);
}
