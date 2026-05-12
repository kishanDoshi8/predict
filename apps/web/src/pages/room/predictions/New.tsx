import {
	Calendar,
	ChevronDownIcon,
	CirclePlus,
	CircleX,
	Clock,
	Flame,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "../../../components/ui/field";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { useEffect, useState } from "react";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "../../../components/ui/toggle-group";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "../../../components/ui/popover";
import { Calendar as UICalendar } from "../../../components/ui/calendar";
import { format } from "date-fns";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Spinner } from "../../../components/ui/spinner";
import { useCreatePrediction } from "@/store/prediction";
import { useRoomContext } from "@/pages/room/RoomLayout";

export default function PredictionNew() {
	const { room } = useRoomContext();
	const { mutate: createPrediction, isPending: isLoading } =
		useCreatePrediction();
	const navigate = useNavigate();
	const maxOptions = 6; // Maximum number of options allowed
	const initialOptions = [
		{ id: 1, text: "", placeholder: "Yes, it will happen" },
		{ id: 2, text: "", placeholder: "No, it will not happen" },
	];
	const [options, setOptions] = useState(initialOptions);
	const [question, setQuestion] = useState("");
	const [biddingDeadline, setBiddingDeadline] = useState("1h");
	const [deadline, setDeadline] = useState("");
	const [deadlineDate, setDeadlineDate] = useState(
		new Date(Date.now() + 1 * 60 * 60 * 1000),
	);
	const [customDate, setCustomDate] = useState<Date | undefined>(
		new Date(Date.now() + 24 * 60 * 60 * 1000),
	);
	const [customTime, setCustomTime] = useState<string>("22:30:00");
	const [openCustomDatePicker, setOpenCustomDatePicker] = useState(false);

	const [errors, setErrors] = useState<string[]>([]);

	useEffect(() => {
		calculateDeadline();
	}, [customDate, customTime, biddingDeadline]);

	useEffect(() => {
		if (errors.includes("question") && question.trim()) {
			setErrors((prev) => prev.filter((err) => err !== "question"));
		} else if (errors.some((err) => err.startsWith("option-"))) {
			options.forEach((option) => {
				if (option.text.trim()) {
					setErrors((prev) =>
						prev.filter((err) => err !== `option-${option.id}`),
					);
				}
			});
		}
	}, [question, options]);

	const handleRemoveOption = (id: number) => {
		if (options.length > 2) {
			setOptions(options.filter((option) => option.id !== id));
		}
	};

	const handleAddOption = () => {
		if (options.length < maxOptions) {
			const newOption = {
				id: Date.now(),
				text: "",
				placeholder: `Option ${options.length + 1}`,
			};
			setOptions([...options, newOption]);
		}
	};

	const handleCreatePrediction = () => {
		const newErrors: string[] = [];
		if (!question.trim()) {
			newErrors.push("question");
		}
		options.forEach((option) => {
			if (!option.text.trim()) {
				newErrors.push(`option-${option.id}`);
			}
		});
		setErrors(newErrors);

		if (newErrors.length === 0) {
			createPrediction(
				{
					roomId: room?.id || "",
					title: question,
					options: options.map((opt) => opt.text),
					deadline: new Date(deadlineDate),
				},
				{
					onSuccess: () => {
						navigate("/rooms/" + room.code);
					},
					onError: (error) => {
						toast("Failed to create prediction.", {
							description: error.message,
						});
					},
				},
			);
		}
	};

	const calculateDeadline = () => {
		const now = new Date();
		const value = biddingDeadline;
		switch (value) {
			case "1h": {
				const formattedDate = new Date(
					now.getTime() + 1 * 60 * 60 * 1000,
				);
				setDeadlineDate(formattedDate);
				setDeadline(
					formattedDate.toLocaleString("en-US", {
						month: "short",
						day: "numeric",
						hour: "numeric",
						minute: "numeric",
						hour12: true,
					}),
				);
				break;
			}
			case "6h": {
				const formattedDate = new Date(
					now.getTime() + 6 * 60 * 60 * 1000,
				);
				setDeadlineDate(formattedDate);
				setDeadline(
					formattedDate.toLocaleString("en-US", {
						month: "short",
						day: "numeric",
						hour: "numeric",
						minute: "numeric",
						hour12: true,
					}),
				);
				break;
			}
			case "12h": {
				const formattedDate = new Date(
					now.getTime() + 12 * 60 * 60 * 1000,
				);
				setDeadlineDate(formattedDate);
				setDeadline(
					formattedDate.toLocaleString("en-US", {
						month: "short",
						day: "numeric",
						hour: "numeric",
						minute: "numeric",
						hour12: true,
					}),
				);
				break;
			}
			case "custom":
				if (customDate && customTime) {
					const [hours, minutes, seconds] = customTime
						.split(":")
						.map(Number);
					const formattedDate = new Date(customDate);
					formattedDate.setHours(hours, minutes, seconds);
					setDeadline(
						formattedDate.toLocaleString("en-US", {
							month: "short",
							day: "numeric",
							hour: "numeric",
							minute: "numeric",
							hour12: true,
						}),
					);
					setDeadlineDate(formattedDate);
				}
				break;
			default:
				setDeadline("");
		}
	};

	return (
		<div className={`p-4`}>
			<FieldSet className={`w-full max-w-md mx-auto`}>
				<h3 className={`text-2xl font-bold`}>Create Prediction</h3>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor='question'>The Question</FieldLabel>
						<Textarea
							id='question'
							placeholder='e.g. "Will Bitcoin reach $100k by Sunday Night?"'
							value={question}
							onChange={(e) => setQuestion(e.target.value)}
							aria-invalid={errors.includes("question")}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor='answer' className={`flex`}>
							<span className={`flex-1`}>Outcome Options</span>
							<span className={`text-muted-foreground`}>
								Min 2 Required
							</span>
						</FieldLabel>
						{options.map((option, i) => (
							<div
								key={option.id}
								className={`flex items-center gap-2`}
							>
								<Input
									id={`answer-${option.id}`}
									aria-invalid={errors.includes(
										`option-${option.id}`,
									)}
									value={option.text}
									onChange={(e) => {
										const newOptions = options.map((opt) =>
											opt.id === option.id
												? {
														...opt,
														text: e.target.value,
													}
												: opt,
										);
										setOptions(newOptions);
									}}
									placeholder={
										option.placeholder
											? option.placeholder
											: `Option ${i + 1}`
									}
								/>
								<Button
									variant={"outline"}
									size={"icon"}
									disabled={i < 2}
									onClick={() =>
										handleRemoveOption(option.id)
									}
								>
									<CircleX />
								</Button>
							</div>
						))}
						<Button
							variant={"outline"}
							size={"sm"}
							className={`mt-2 text-primary`}
							onClick={handleAddOption}
							disabled={options.length >= maxOptions}
						>
							<CirclePlus className={`mr-2`} />
							Add Option
						</Button>

						<FieldLabel htmlFor='deadline' className={`mt-4`}>
							Bidding deadline
						</FieldLabel>
						<ToggleGroup
							id='deadline'
							type='single'
							variant='outline'
							spacing={2}
							className={`flex`}
							value={biddingDeadline}
							onValueChange={(value) => {
								setBiddingDeadline(value);
							}}
						>
							<ToggleGroupItem
								value='1h'
								aria-label='1 hour'
								className='flex-1 data-[state=on]:border data-[state=on]:border-primary data-[state=on]:text-primary data-[state=on]:ring-1 data-[state=on]:ring-primary'
							>
								1h
							</ToggleGroupItem>
							<ToggleGroupItem
								value='6h'
								aria-label='6 hours'
								className='flex-1 data-[state=on]:border data-[state=on]:border-primary data-[state=on]:text-primary data-[state=on]:ring-1 data-[state=on]:ring-primary'
							>
								6h
							</ToggleGroupItem>
							<ToggleGroupItem
								value='12h'
								aria-label='12 hours'
								className='flex-1 data-[state=on]:border data-[state=on]:border-primary data-[state=on]:text-primary data-[state=on]:ring-1 data-[state=on]:ring-primary'
							>
								12h
							</ToggleGroupItem>
							<ToggleGroupItem
								value='custom'
								aria-label='Custom'
								className='flex-1 data-[state=on]:border data-[state=on]:border-primary data-[state=on]:text-primary data-[state=on]:ring-1 data-[state=on]:ring-primary'
							>
								<Calendar />
							</ToggleGroupItem>
						</ToggleGroup>

						{biddingDeadline === "custom" && (
							<div className={`flex items-center gap-4 mt-4`}>
								<div className={`flex-1`}>
									<Popover
										open={openCustomDatePicker}
										onOpenChange={setOpenCustomDatePicker}
									>
										<PopoverTrigger asChild>
											<Button
												variant='outline'
												className='justify-between'
											>
												{customDate
													? format(customDate, "PPP")
													: "Select date"}
												<ChevronDownIcon />
											</Button>
										</PopoverTrigger>
										<PopoverContent
											className='w-auto overflow-hidden p-0'
											align='start'
										>
											<UICalendar
												mode='single'
												selected={customDate}
												defaultMonth={customDate}
												captionLayout='dropdown'
												disabled={{
													before: new Date(),
												}}
												onSelect={(date) => {
													setCustomDate(date);
													setOpenCustomDatePicker(
														false,
													);
												}}
											/>
										</PopoverContent>
									</Popover>
								</div>
								<Input
									type='time'
									step='1'
									value={customTime}
									onChange={(e) => {
										setCustomTime(e.target.value);
									}}
									className='appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none'
								/>
							</div>
						)}

						<Alert>
							<Clock className={`text-muted-foreground`} />
							<AlertDescription>
								Prediction locks at {deadline?.toLocaleString()}
							</AlertDescription>
						</Alert>
					</Field>
				</FieldGroup>
				<Button
					className={`w-full mt-6 cursor-pointer`}
					onClick={handleCreatePrediction}
					disabled={isLoading}
				>
					{isLoading && <Spinner />}
					Start Draft <Flame fill='black' />
				</Button>
				<Button
					variant={"outline"}
					className={`w-full`}
					onClick={() => navigate("/rooms/" + room.code)}
					disabled={isLoading}
				>
					Cancel
				</Button>
			</FieldSet>
		</div>
	);
}
