import { useRoomContext } from "@/app/layouts/RoomLayout";
import { usePlayer } from "@/features/home";
import { useCreateSeries } from "@/features/series";
import { Button, Input } from "@/shared/ui";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/shared/ui/field";
import { Textarea } from "@/shared/ui/textarea";
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type FormState = {
	title: string;
	description: string;
	expectedGames: string;
};

const DEFAULT_FORM: FormState = {
	title: "",
	description: "",
	expectedGames: "3",
};

const DESCRIPTION_MAX_LENGTH = 240;

export default function SeriesCreatePage() {
	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const navigate = useNavigate();
	const { mutate: createSeries, isPending } = useCreateSeries(room.id);

	const [form, setForm] = useState<FormState>(DEFAULT_FORM);

	const isOrganizer = room.members.some(
		(member) => member.player_id === player?.id && member.is_organizer,
	);

	const descriptionCount = form.description.length;
	const titleError = useMemo(() => {
		if (form.title.trim().length > 0) {
			return "";
		}
		return "Title is required.";
	}, [form.title]);

	const expectedGamesError = useMemo(() => {
		const expectedGames = Number(form.expectedGames);
		if (!Number.isInteger(expectedGames) || expectedGames < 0) {
			return "Expected games must be a non-negative integer.";
		}
		return "";
	}, [form.expectedGames]);

	const canSubmit =
		!isPending &&
		titleError.length === 0 &&
		expectedGamesError.length === 0 &&
		isOrganizer;

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!isOrganizer) {
			toast("Only room organizers can create a series.");
			return;
		}

		if (titleError.length > 0) {
			toast(titleError);
			return;
		}

		if (expectedGamesError.length > 0) {
			toast(expectedGamesError);
			return;
		}

		createSeries(
			{
				title: form.title.trim(),
				description: form.description.trim(),
				expectedGames: Number(form.expectedGames),
			},
			{
				onSuccess: () => {
					toast("Series created.");
					navigate(`/rooms/${room.code}/series`, { replace: true });
				},
				onError: (error) => {
					toast("Failed to create series.", {
						description: error.message,
					});
				},
			},
		);
	};

	return (
		<div className='mx-auto w-full max-w-md space-y-5 p-4'>
			<div>
				<h2 className='text-lg font-semibold'>New series</h2>
				<p className='mt-1 text-sm text-muted-foreground'>
					Set up a series to group related predictions and track
					progress.
				</p>
			</div>

			<form
				className='space-y-4 rounded-2xl border p-4'
				onSubmit={handleSubmit}
			>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor='series-title'>Title</FieldLabel>
						<Input
							id='series-title'
							placeholder='e.g. Premier League Matchweek 6'
							value={form.title}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									title: event.target.value,
								}))
							}
							disabled={isPending}
							required
						/>
						<FieldDescription>
							Use a short, clear name members can recognize
							quickly.
						</FieldDescription>
					</Field>

					<Field>
						<FieldLabel htmlFor='series-description'>
							Description
						</FieldLabel>
						<Textarea
							id='series-description'
							placeholder='What is this series about?'
							value={form.description}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									description: event.target.value.slice(
										0,
										DESCRIPTION_MAX_LENGTH,
									),
								}))
							}
							disabled={isPending}
						/>
						<FieldDescription>
							Optional. {descriptionCount}/
							{DESCRIPTION_MAX_LENGTH}
						</FieldDescription>
					</Field>

					<Field>
						<FieldLabel htmlFor='series-expected-games'>
							Expected games
						</FieldLabel>
						<Input
							id='series-expected-games'
							type='number'
							min={0}
							step={1}
							value={form.expectedGames}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									expectedGames: event.target.value,
								}))
							}
							disabled={isPending}
						/>
						<FieldDescription>
							How many predictions are planned in this series.
						</FieldDescription>
					</Field>
				</FieldGroup>

				<div className='flex justify-end gap-2'>
					<Button
						type='button'
						variant='outline'
						onClick={() =>
							navigate(`/rooms/${room.code}/series`, {
								replace: true,
							})
						}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button type='submit' disabled={!canSubmit}>
						{isPending ? "Creating..." : "Create series"}
					</Button>
				</div>
			</form>

			{!isOrganizer ? (
				<p className='text-sm text-muted-foreground'>
					Only room organizers can create a series.
				</p>
			) : null}
		</div>
	);
}
