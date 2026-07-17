import { useRoomContext } from "@/app/layouts/RoomLayout";
import { usePlayer } from "@/features/home";
import {
	useActivateSeries,
	useArchiveSeries,
	useCompleteSeries,
	useCreateSeries,
	useRoomSeries,
	useUpdateSeries,
} from "@/features/rooms";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { toast } from "sonner";
import { useMemo, useState } from "react";

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

export default function RoomProfilePage() {
	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const { data: seriesByStatus, isPending } = useRoomSeries(room.id);
	const { mutate: createSeries, isPending: isCreatePending } =
		useCreateSeries(room.id);
	const { mutate: updateSeries, isPending: isUpdatePending } =
		useUpdateSeries(room.id);
	const { mutate: activateSeries, isPending: isActivatePending } =
		useActivateSeries(room.id);
	const { mutate: completeSeries, isPending: isCompletePending } =
		useCompleteSeries(room.id);
	const { mutate: archiveSeries, isPending: isArchivePending } =
		useArchiveSeries(room.id);
	const isOrganizer = room.members.some(
		(member) => member.player_id === player?.id && member.is_organizer,
	);
	const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
	const [formState, setFormState] = useState<SeriesFormState>(defaultFormState);

	const isSaving = isCreatePending || isUpdatePending;
	const isActionPending = isActivatePending || isCompletePending || isArchivePending;

	const sections = useMemo(
		() => [
			{
				key: "draft",
				title: "Draft",
				items: seriesByStatus?.draft ?? [],
			},
			{
				key: "active",
				title: "Active",
				items: seriesByStatus?.active ?? [],
			},
			{
				key: "completed",
				title: "Completed",
				items: seriesByStatus?.completed ?? [],
			},
			{
				key: "archived",
				title: "Archived",
				items: seriesByStatus?.archived ?? [],
			},
		],
		[seriesByStatus],
	);

	const resetForm = () => {
		setEditingSeriesId(null);
		setFormState(defaultFormState);
	};

	const handleSubmit = () => {
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

		const payload = {
			title,
			description: formState.description,
			expectedGames,
		};

		if (editingSeriesId) {
			updateSeries(
				{ seriesId: editingSeriesId, ...payload },
				{
					onSuccess: () => {
						toast("Series updated.");
						resetForm();
					},
					onError: (error) => {
						toast("Failed to update series.", {
							description: error.message,
						});
					},
				},
			);
			return;
		}

		createSeries(payload, {
			onSuccess: () => {
				toast("Series created.");
				resetForm();
			},
			onError: (error) => {
				toast("Failed to create series.", {
					description: error.message,
				});
			},
		});
	};

	const handleActivate = (seriesId: string) => {
		activateSeries(seriesId, {
			onError: (error) =>
				toast("Failed to activate series.", {
					description: error.message,
				}),
		});
	};

	const handleComplete = (seriesId: string) => {
		completeSeries(seriesId, {
			onError: (error) =>
				toast("Failed to complete series.", {
					description: error.message,
				}),
		});
	};

	const handleArchive = (seriesId: string) => {
		archiveSeries(seriesId, {
			onError: (error) =>
				toast("Failed to archive series.", {
					description: error.message,
				}),
		});
	};

	const handleEdit = (
		seriesId: string,
		title: string,
		description: string | null,
		expectedGames: number,
	) => {
		setEditingSeriesId(seriesId);
		setFormState({
			title,
			description: description ?? "",
			expectedGames: String(expectedGames),
		});
	};

	return (
		<div className='mx-auto w-full max-w-lg space-y-4 p-4'>
			<div>
				<h2 className='text-lg font-semibold'>Series</h2>
				<p className='mt-1 text-sm text-muted-foreground'>
					Manage prediction series lifecycle and assign new predictions.
				</p>
			</div>

			{isOrganizer ? (
				<div className='space-y-2 rounded-xl border p-3'>
					<h3 className='text-sm font-medium'>
						{editingSeriesId ? "Edit Series" : "Create Series"}
					</h3>
					<Input
						placeholder='Series title'
						value={formState.title}
						onChange={(event) =>
							setFormState((current) => ({
								...current,
								title: event.target.value,
							}))
						}
						disabled={isSaving}
					/>
					<Textarea
						placeholder='Description (optional)'
						value={formState.description}
						onChange={(event) =>
							setFormState((current) => ({
								...current,
								description: event.target.value,
							}))
						}
						disabled={isSaving}
					/>
					<Input
						type='number'
						min={0}
						step={1}
						placeholder='Expected games'
						value={formState.expectedGames}
						onChange={(event) =>
							setFormState((current) => ({
								...current,
								expectedGames: event.target.value,
							}))
						}
						disabled={isSaving}
					/>
					<div className='flex gap-2'>
						<Button onClick={handleSubmit} disabled={isSaving}>
							{editingSeriesId ? "Save" : "Create"}
						</Button>
						{editingSeriesId ? (
							<Button
								variant='outline'
								onClick={resetForm}
								disabled={isSaving}
							>
								Cancel
							</Button>
						) : null}
					</div>
				</div>
			) : (
				<p className='text-sm text-muted-foreground'>
					Only the room organizer can modify series.
				</p>
			)}

			{isPending ? (
				<p className='text-sm text-muted-foreground'>Loading series...</p>
			) : (
				sections.map((section) => (
					<div key={section.key} className='space-y-2'>
						<h3 className='text-sm font-semibold uppercase text-muted-foreground'>
							{section.title}
						</h3>
						{section.items.length === 0 ? (
							<p className='text-sm text-muted-foreground'>
								No {section.title.toLowerCase()} series.
							</p>
						) : (
							section.items.map((series) => (
								<div
									key={series.id}
									className='space-y-2 rounded-xl border p-3'
								>
									<div>
										<p className='font-medium'>{series.title}</p>
										{series.description ? (
											<p className='text-sm text-muted-foreground'>
												{series.description}
											</p>
										) : null}
										<p className='text-xs text-muted-foreground'>
											Expected games: {series.expectedGames} · Predictions:{" "}
											{series.predictionCount}
										</p>
									</div>
									{isOrganizer ? (
										<div className='flex flex-wrap gap-2'>
											{series.status !== "archived" ? (
												<Button
													size='sm'
													variant='outline'
													onClick={() =>
														handleEdit(
															series.id,
															series.title,
															series.description,
															series.expectedGames,
														)
													}
													disabled={isSaving || isActionPending}
												>
													Edit
												</Button>
											) : null}
											{series.status === "draft" ? (
												<Button
													size='sm'
													onClick={() => handleActivate(series.id)}
													disabled={isActionPending}
												>
													Activate
												</Button>
											) : null}
											{series.status === "active" ? (
												<Button
													size='sm'
													onClick={() => handleComplete(series.id)}
													disabled={isActionPending}
												>
													Complete
												</Button>
											) : null}
											{series.status === "completed" ? (
												<Button
													size='sm'
													onClick={() => handleArchive(series.id)}
													disabled={isActionPending}
												>
													Archive
												</Button>
											) : null}
										</div>
									) : null}
								</div>
							))
						)}
					</div>
				))
			)}
		</div>
	);
}
