import { usePlayer } from "@/features/home";
import { useRoomContext } from "@/app/layouts/RoomLayout";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Button,
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
	Field,
	FieldContent,
	FieldLabel,
	FieldTitle,
	Input,
	RadioGroup,
	RadioGroupItem,
	Spinner,
} from "@/shared/ui";
import { useResolvePrediction } from "@/features/predictions";
import { useEffect, useState } from "react";
import { Prediction } from "@/features/predictions";
import { InfoIcon } from "lucide-react";
import { toast } from "sonner";

type LockControlsProps = {
	prediction: Prediction;
};

export default function LockControls({
	prediction,
}: Readonly<LockControlsProps>) {
	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const { mutate: resolveMutation, isPending: isResolvingPrediction } =
		useResolvePrediction();

	const [selectedOption, setSelectedOption] = useState<string | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

	const isRoomAdmin = room.members.find(
		(m) => m.player_id === player?.id,
	)?.is_organizer;

	if (!isRoomAdmin) {
		return null;
	}

	const handleOnClose = () => {
		setSelectedOption(null);
	};

	const handleOnSuccess = () => {
		setIsDrawerOpen(false);
	};

	if (prediction.status !== "locked") {
		return null;
	}

	return (
		<div
			className={`sticky bottom-2 left-0 right-0 p-4 flex bg-background/45 w-full max-w-2xs mx-auto rounded-lg `}
		>
			<Drawer
				onClose={handleOnClose}
				open={isDrawerOpen}
				onOpenChange={setIsDrawerOpen}
			>
				<DrawerTrigger asChild>
					<Button variant={"linear"} className={`w-full`} size='lg'>
						Reveal Results
					</Button>
				</DrawerTrigger>
				<DrawerContent className={`sm:max-w-md mx-auto`}>
					<DrawerHeader>
						<DrawerTitle>Reveal Results</DrawerTitle>
						<DrawerDescription>
							<span>Choose an option to reveal the results</span>
							<RadioGroup
								className={`w-full mt-4`}
								value={selectedOption}
								onValueChange={setSelectedOption}
							>
								{prediction.prediction_options.map((option) => (
									<FieldLabel
										key={option.id}
										className={`flex items-center gap-2 cursor-pointer`}
									>
										<Field orientation={"horizontal"}>
											<RadioGroupItem
												value={option.id}
												id={option.id}
											/>
											<FieldContent>
												<FieldTitle>
													<span>{option.label}</span>
												</FieldTitle>
											</FieldContent>
										</Field>
									</FieldLabel>
								))}
							</RadioGroup>
						</DrawerDescription>
					</DrawerHeader>
					<DrawerFooter className={`gap-4`}>
						<DrawerClose asChild>
							<Button variant='outline' size='lg'>
								Cancel
							</Button>
						</DrawerClose>
						<NoResult
							prediction={prediction}
							resolvePrediction={resolveMutation}
							isResolvingPrediction={isResolvingPrediction}
							onSuccess={handleOnSuccess}
						/>
						<RevealResults
							selectedOption={selectedOption}
							prediction={prediction}
							resolvePrediction={resolveMutation}
							isResolvingPrediction={isResolvingPrediction}
							onSuccess={handleOnSuccess}
						/>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		</div>
	);
}

function NoResult({
	prediction,
	resolvePrediction,
	isResolvingPrediction,
	onSuccess,
}: Readonly<{
	prediction: Prediction;
	resolvePrediction: ReturnType<typeof useResolvePrediction>["mutate"];
	isResolvingPrediction: boolean;
	onSuccess: () => void;
}>) {
	const { room } = useRoomContext();

	const [noResultReason, setNoResultReason] = useState<string | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

	const handleOnNoResult = () => {
		resolvePrediction(
			{
				predictionId: prediction.id,
				outcome: "no_result",
				roomId: room.id,
				noResultReason,
			},
			{
				onSuccess: () => {
					setIsDrawerOpen(false);
					onSuccess();
					setTimeout(() => {
						toast.success("Prediction ended with no result.", {
							dismissible: true,
							duration: 5000,
							position: "top-center",
						});
					}, 500);
				},
				onError: (error) => {
					toast.error("Failed to end prediction with no result.", {
						description: error.message,
						dismissible: true,
						duration: Infinity,
						position: "top-center",
					});
				},
			},
		);
	};

	return (
		<Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
			<DialogTrigger asChild>
				<Button variant='secondary' size='lg'>
					No Result
				</Button>
			</DialogTrigger>
			<DialogContent
				className={`sm:max-w-md mx-auto`}
				onOpenAutoFocus={(e) => {
					e.preventDefault();
				}}
			>
				<DialogHeader>
					<DialogTitle>Are you sure?</DialogTitle>
					<DialogDescription>
						Are you sure you want to end the prediction with no
						result? This action cannot be undone.
						<Alert className={`mt-4`}>
							<InfoIcon />
							<AlertDescription>
								This will return all bets and no one will win or
								lose points.
							</AlertDescription>
						</Alert>
					</DialogDescription>
				</DialogHeader>
				<Input
					placeholder='Reason (optional)'
					className={`w-full`}
					value={noResultReason ?? ""}
					onChange={(e) => setNoResultReason(e.target.value)}
					autoFocus={false}
				/>
				<DialogFooter className={`gap-4 mt-4`}>
					<DialogClose asChild>
						<Button
							variant='outline'
							size='lg'
							disabled={isResolvingPrediction}
						>
							Cancel
						</Button>
					</DialogClose>
					<Button
						variant='destructive'
						size='lg'
						onClick={handleOnNoResult}
						disabled={isResolvingPrediction}
					>
						{isResolvingPrediction && <Spinner />}
						Confirm No Result
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function RevealResults({
	selectedOption,
	prediction,
	resolvePrediction,
	isResolvingPrediction,
	onSuccess,
}: Readonly<{
	selectedOption: string | null;
	prediction: Prediction;
	resolvePrediction: ReturnType<typeof useResolvePrediction>["mutate"];
	isResolvingPrediction: boolean;
	onSuccess: () => void;
}>) {
	const [optionLabel, setOptionLabel] = useState<string | null>(null);
	const { room } = useRoomContext();

	const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

	useEffect(() => {
		if (!prediction || !selectedOption) {
			setOptionLabel(null);
			return;
		}
		const option = prediction.prediction_options.find(
			(o) => o.id === selectedOption,
		);
		setOptionLabel(option?.label ?? null);
	}, [prediction, selectedOption]);

	const handleOnRevealWin = () => {
		if (!selectedOption || !prediction) {
			return;
		}
		resolvePrediction(
			{
				predictionId: prediction.id,
				outcome: "win",
				winningOptionId: selectedOption,
				roomId: room.id,
			},
			{
				onError: (error) => {
					toast.error("Failed to reveal results.", {
						description: error.message,
						dismissible: true,
						duration: 7000,
						position: "top-center",
					});
				},
				onSuccess: () => {
					toast.success("Results revealed successfully!", {
						dismissible: true,
						duration: 5000,
						position: "top-center",
					});
					setIsDrawerOpen(false);
					onSuccess();
				},
			},
		);
	};

	return (
		<Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
			<DialogTrigger asChild>
				<Button
					variant={"linear"}
					className={`w-full`}
					size='lg'
					disabled={!selectedOption}
				>
					Reveal Results
				</Button>
			</DialogTrigger>
			<DialogContent className={`sm:max-w-md mx-auto`}>
				<DialogHeader>
					<DialogTitle>Are you sure?</DialogTitle>
					<DialogDescription>
						Are you sure you want to reveal the results? This action
						cannot be undone.
						<Alert className={`mt-4`}>
							<InfoIcon />
							<AlertTitle>
								Selected Option: {optionLabel}
							</AlertTitle>
						</Alert>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className={`gap-4`}>
					<DialogClose asChild>
						<Button variant='outline' size='lg'>
							Cancel
						</Button>
					</DialogClose>
					<Button
						size='lg'
						onClick={handleOnRevealWin}
						disabled={isResolvingPrediction}
					>
						{isResolvingPrediction && <Spinner />}
						Confirm
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
