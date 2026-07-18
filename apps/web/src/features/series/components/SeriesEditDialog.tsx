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

type SeriesFormState = {
	title: string;
	description: string;
	expectedGames: string;
};

type SeriesEditDialogProps = {
	open: boolean;
	isUpdatePending: boolean;
	formState: SeriesFormState;
	onOpenChange: (open: boolean) => void;
	onFormStateChange: (nextState: SeriesFormState) => void;
	onCancel: () => void;
	onSave: () => void;
};

export function SeriesEditDialog({
	open,
	isUpdatePending,
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
