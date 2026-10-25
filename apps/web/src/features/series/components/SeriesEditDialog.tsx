import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	Input,
} from "@/shared/ui";
import { Textarea } from "@/shared/ui/textarea";
import type { ChangeEvent } from "react";

export type SeriesFormState = {
	title: string;
	description: string;
	expectedGames: string;
	startingStack: string;
	weeklyTopup: string;
	minBetsToRank: string;
};

type SeriesEditDialogProps = {
	open: boolean;
	isUpdatePending: boolean;
	// Points settings can't change once anyone has bet in the series.
	pointsLocked: boolean;
	// The ranking bar is fixed once a series is closed.
	rankingLocked: boolean;
	formState: SeriesFormState;
	onOpenChange: (open: boolean) => void;
	onFormStateChange: (nextState: SeriesFormState) => void;
	onCancel: () => void;
	onSave: () => void;
};

export function SeriesEditDialog({
	open,
	isUpdatePending,
	pointsLocked,
	rankingLocked,
	formState,
	onOpenChange,
	onFormStateChange,
	onCancel,
	onSave,
}: Readonly<SeriesEditDialogProps>) {
	const updateField =
		(field: keyof SeriesFormState) =>
		(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			onFormStateChange({
				...formState,
				[field]: event.target.value,
			});
		};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit series</DialogTitle>
				</DialogHeader>
				<div className='space-y-3'>
					<Input
						placeholder='Series title'
						value={formState.title}
						onChange={updateField("title")}
						disabled={isUpdatePending}
					/>
					<Textarea
						placeholder='Description (optional)'
						value={formState.description}
						onChange={updateField("description")}
						disabled={isUpdatePending}
					/>
					<Input
						type='number'
						min={0}
						step={1}
						placeholder='Expected games'
						value={formState.expectedGames}
						onChange={updateField("expectedGames")}
						disabled={isUpdatePending}
					/>
					<div className='grid grid-cols-2 gap-3'>
						<label className='space-y-1 text-sm'>
							<span className='text-muted-foreground'>
								Starting points
							</span>
							<Input
								type='number'
								min={100}
								step={100}
								value={formState.startingStack}
								onChange={updateField("startingStack")}
								disabled={isUpdatePending || pointsLocked}
							/>
						</label>
						<label className='space-y-1 text-sm'>
							<span className='text-muted-foreground'>
								Weekly top-up
							</span>
							<Input
								type='number'
								min={0}
								step={10}
								value={formState.weeklyTopup}
								onChange={updateField("weeklyTopup")}
								disabled={isUpdatePending || pointsLocked}
							/>
						</label>
					</div>
					{pointsLocked ? (
						<p className='text-xs text-muted-foreground'>
							Points settings are locked once anyone has placed a
							bet.
						</p>
					) : null}
					<label className='block space-y-1 text-sm'>
						<span className='text-muted-foreground'>
							Minimum bets to be ranked
						</span>
						<Input
							type='number'
							min={0}
							max={50}
							step={1}
							value={formState.minBetsToRank}
							onChange={updateField("minBetsToRank")}
							disabled={isUpdatePending || rankingLocked}
						/>
						<span className='block text-xs text-muted-foreground'>
							Players who bet on fewer settled predictions don't
							appear in the standings or win the title. You can
							change this while the series runs.
						</span>
					</label>
					<div className='flex justify-end gap-2'>
						<Button
							variant='outline'
							onClick={onCancel}
							disabled={isUpdatePending}
						>
							Cancel
						</Button>
						<Button onClick={onSave} disabled={isUpdatePending}>
							Save
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
