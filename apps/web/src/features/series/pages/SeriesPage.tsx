import { useRoomContext } from "@/app/layouts/RoomLayout";
import { usePlayer } from "@/features/home";
import {
	usePredictionHistory,
	useSeriesLeaderboard,
} from "@/features/leaderboard";
import { useActivePredictions } from "@/features/predictions";
import { SeriesDetailView, SeriesListView } from "@/features/series/components";
import {
	useCollectSeriesRewards,
	useRoomSeries,
	useSeriesAwards,
	useSeriesPlacements,
	useUpdateSeries,
	useCompleteSeries,
} from "@/features/series";
import type { Series } from "@/features/series/types/series";
import { Button, Skeleton } from "@/shared/ui";
import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

type SeriesFormState = {
	title: string;
	description: string;
	expectedGames: string;
};

const defaultFormState: SeriesFormState = {
	title: "",
	description: "",
	expectedGames: "0",
};

type SeriesByStatus = {
	draft?: Series[];
	active?: Series[];
	completed?: Series[];
	archived?: Series[];
};

function getAllSeries(seriesByStatus?: SeriesByStatus) {
	return [
		...(seriesByStatus?.draft ?? []),
		...(seriesByStatus?.active ?? []),
		...(seriesByStatus?.completed ?? []),
		...(seriesByStatus?.archived ?? []),
	];
}

function saveSeriesEdit({
	editingSeriesId,
	formState,
	updateSeries,
}: {
	editingSeriesId: string | null;
	formState: SeriesFormState;
	updateSeries: (args: {
		seriesId: string;
		title: string;
		description: string;
		expectedGames: number;
	}) => void;
}) {
	if (!editingSeriesId) {
		return;
	}

	const title = formState.title.trim();
	const expectedGames = Number(formState.expectedGames);

	if (!title) {
		toast("Series title is required.");
		return;
	}

	if (!Number.isInteger(expectedGames) || expectedGames < 0) {
		toast("Expected games must be a non-negative integer.");
		return;
	}

	updateSeries({
		seriesId: editingSeriesId,
		title,
		description: formState.description,
		expectedGames,
	});
}

export default function SeriesPage() {
	const { room } = useRoomContext();
	const { seriesId } = useParams<{ seriesId?: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const { data: player } = usePlayer();
	const { data: seriesByStatus, isPending } = useRoomSeries(room.id);
	const { data: roomPredictions = [] } = useActivePredictions(
		room.id,
		seriesId,
	);
	const { data: seriesHistoryPages, isPending: isSeriesHistoryPending } =
		usePredictionHistory(room.id, "all", "", seriesId);

	const { mutate: updateSeries, isPending: isUpdatePending } =
		useUpdateSeries(room.id);
	const { mutate: completeSeries, isPending: isCompleteSeriesPending } =
		useCompleteSeries(room.id);

	const isOrganizer = room.members.some(
		(member) => member.player_id === player?.id && member.is_organizer,
	);

	const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [formState, setFormState] =
		useState<SeriesFormState>(defaultFormState);

	const isActionPending = false;

	const activeSeries = seriesByStatus?.active ?? [];
	const completedSeries = seriesByStatus?.completed ?? [];

	const allSeries = useMemo(
		() => getAllSeries(seriesByStatus),
		[seriesByStatus],
	);

	const selectedSeries = useMemo(
		() => allSeries.find((series) => series.id === seriesId) ?? null,
		[allSeries, seriesId],
	);
	const {
		data: seriesLeaderboard = [],
		isPending: isSeriesLeaderboardLoading,
	} = useSeriesLeaderboard(
		room.id,
		selectedSeries?.id ?? null,
		!!selectedSeries,
	);
	const isClosedSeries =
		selectedSeries?.status === "completed" ||
		selectedSeries?.status === "archived";
	const {
		data: seriesPlacements = [],
		isPending: isSeriesPlacementsLoading,
	} = useSeriesPlacements(
		room.id,
		selectedSeries?.id ?? null,
		!!isClosedSeries,
	);
	const { data: seriesAwards = [], isPending: isSeriesAwardsLoading } =
		useSeriesAwards(room.id, selectedSeries?.id ?? null, !!isClosedSeries);
	const {
		mutate: collectSeriesRewards,
		isPending: isCollectSeriesRewardsPending,
	} = useCollectSeriesRewards(room.id, selectedSeries?.id ?? null);

	const seriesOpenPredictions = useMemo(() => {
		if (!selectedSeries) {
			return [];
		}

		return roomPredictions.filter((prediction) => {
			const predictionSeriesId =
				prediction.seriesId ?? prediction.series_id;
			return (
				predictionSeriesId === selectedSeries.id &&
				(prediction.status === "draft" ||
					prediction.status === "locked")
			);
		});
	}, [roomPredictions, selectedSeries]);

	const seriesCompletedPredictions = useMemo(
		() =>
			seriesHistoryPages?.pages
				.flatMap((page) => page.items)
				.slice(0, 20) ?? [],
		[seriesHistoryPages],
	);

	const handleArchive = (targetSeriesId: string) => {
		toast("Archive series callback triggered.", {
			description: `Series ${targetSeriesId} is pending backend wiring.`,
		});
	};

	const handleCloseSeries = (targetSeriesId: string) => {
		completeSeries(targetSeriesId, {
			onSuccess: () => {
				toast("Series closed.");
			},
			onError: (error) => {
				toast("Failed to close series.", {
					description: error.message,
				});
			},
		});
	};

	const openEditDialog = (series: Series) => {
		setEditingSeriesId(series.id);
		setFormState({
			title: series.title,
			description: series.description ?? "",
			expectedGames: String(series.expectedGames),
		});
		setIsEditorOpen(true);
	};

	const resetEditor = () => {
		setEditingSeriesId(null);
		setFormState(defaultFormState);
		setIsEditorOpen(false);
	};

	const handleUpdateSeries = (payload: {
		seriesId: string;
		title: string;
		description: string;
		expectedGames: number;
	}) => {
		updateSeries(payload, {
			onSuccess: () => {
				toast("Series updated.");
				resetEditor();
			},
			onError: (error) => {
				toast("Failed to update series.", {
					description: error.message,
				});
			},
		});
	};

	const handleSaveEdit = () => {
		saveSeriesEdit({
			editingSeriesId,
			formState,
			updateSeries: handleUpdateSeries,
		});
	};

	const handleCollectRewards = () => {
		collectSeriesRewards(undefined, {
			onSuccess: () => {
				toast("Rewards collected.");
			},
			onError: (error) => {
				toast("Failed to collect rewards.", {
					description: error.message,
				});
			},
		});
	};

	if (!seriesId) {
		return (
			<SeriesListView
				isPending={isPending}
				activeSeries={activeSeries}
				completedSeries={completedSeries}
				roomCode={room.code}
				isOrganizer={isOrganizer}
				onCreateNew={() => navigate(`/rooms/${room.code}/series/new`)}
			/>
		);
	}

	if (isPending) {
		return (
			<div className='mx-auto w-full max-w-md space-y-4 p-4'>
				<Skeleton className='h-10 w-1/2 rounded-lg' />
				<Skeleton className='h-40 w-full rounded-2xl' />
				<Skeleton className='h-52 w-full rounded-2xl' />
			</div>
		);
	}

	if (!selectedSeries) {
		return (
			<div className='mx-auto w-full max-w-md space-y-4 p-4'>
				<p className='text-sm text-muted-foreground'>
					Series not found.
				</p>
				<Button
					variant='outline'
					onClick={() => navigate(`/rooms/${room.code}/series`)}
				>
					Back to series
				</Button>
			</div>
		);
	}

	return (
		<SeriesDetailView
			series={selectedSeries}
			isOrganizer={isOrganizer}
			isActionPending={
				isUpdatePending || isActionPending || isCompleteSeriesPending
			}
			isUpdatePending={isUpdatePending}
			seriesOpenPredictions={seriesOpenPredictions}
			seriesCompletedPredictions={seriesCompletedPredictions}
			isCompletedPredictionsLoading={isSeriesHistoryPending}
			seriesLeaderboard={seriesLeaderboard}
			isSeriesLeaderboardLoading={isSeriesLeaderboardLoading}
			seriesPlacements={seriesPlacements}
			isSeriesPlacementsLoading={isSeriesPlacementsLoading}
			seriesAwards={seriesAwards}
			isSeriesAwardsLoading={isSeriesAwardsLoading}
			currentPlayerId={player?.id ?? null}
			onCollectRewards={handleCollectRewards}
			isCollectRewardsPending={isCollectSeriesRewardsPending}
			isEditorOpen={isEditorOpen}
			formState={formState}
			onBackToList={() => navigate(`/rooms/${room.code}/series`)}
			onEdit={() => openEditDialog(selectedSeries)}
			onArchive={() => handleArchive(selectedSeries.id)}
			onCloseSeries={() => handleCloseSeries(selectedSeries.id)}
			onNewPrediction={() =>
				navigate(`/rooms/${room.code}/predictions/new`, {
					state: {
						from: location.pathname,
						seriesId: selectedSeries.id,
					},
				})
			}
			onEditDialogOpenChange={setIsEditorOpen}
			onFormStateChange={setFormState}
			onCancelEdit={resetEditor}
			onSaveEdit={handleSaveEdit}
		/>
	);
}
