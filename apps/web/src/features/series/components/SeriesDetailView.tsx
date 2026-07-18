import { SeriesEditDialog } from "@/features/series/components/SeriesEditDialog";
import { SeriesOverviewCard } from "@/features/series/components/SeriesOverviewCard";
import { SeriesRecentActivitySection } from "@/features/series/components/SeriesRecentActivitySection";
import type { RoomActivity } from "@/features/activities/types/types";
import { PredictionHistoryFeed } from "@/features/leaderboard";
import { InPlayPredictions, UserStats } from "@/features/predictions";
import type { Prediction } from "@/features/predictions";
import type { Series } from "@/features/series/types/series";
import { Button } from "@/shared/ui";
import { ChevronLeftIcon, RocketIcon } from "lucide-react";

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
	isEditorOpen: boolean;
	formState: SeriesFormState;
	onBackToList: () => void;
	onEdit: () => void;
	onActivate: () => void;
	onComplete: () => void;
	onArchive: () => void;
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
	isEditorOpen,
	formState,
	onBackToList,
	onEdit,
	onActivate,
	onComplete,
	onArchive,
	onNewPrediction,
	onEditDialogOpenChange,
	onFormStateChange,
	onCancelEdit,
	onSaveEdit,
}: Readonly<SeriesDetailViewProps>) {
	return (
		<div className='mx-auto w-full max-w-md space-y-6 p-4'>
			<Button
				variant='outline'
				size='sm'
				onClick={onBackToList}
				className='rounded-2xl text-muted-foreground'
			>
				<ChevronLeftIcon className='mr-2 h-4 w-4' />
				Back to series
			</Button>

			<SeriesOverviewCard
				series={series}
				isOrganizer={isOrganizer}
				isActionPending={isActionPending}
				onEdit={onEdit}
				onActivate={onActivate}
				onComplete={onComplete}
				onArchive={onArchive}
			/>

			<section className='space-y-3'>
				<h3 className='text-sm font-semibold uppercase text-muted-foreground'>
					Open predictions
				</h3>
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
					subtitle='Current standings for this room.'
					showSeeAllLink={false}
				/>
			</section>

			<SeriesRecentActivitySection
				isLoading={isActivityLoading}
				activities={seriesActivities}
				roomCode={roomCode}
			/>

			<section className='space-y-3'>
				<h3 className='text-sm font-semibold uppercase text-muted-foreground'>
					Completed predictions
				</h3>
				<PredictionHistoryFeed
					entries={[]}
					isLoading={false}
					emptyMessage='Completed predictions for this series will appear here soon.'
				/>
			</section>

			{isOrganizer ? (
				<div
					className='fixed right-4 z-50 mb-4'
					style={{
						bottom: "calc(4.5rem + env(safe-area-inset-bottom))",
					}}
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
		</div>
	);
}
