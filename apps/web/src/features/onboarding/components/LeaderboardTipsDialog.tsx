import StepperTipsDialog from "@/features/onboarding/components/StepperTipsDialog";
import { CoinsIcon, ZapIcon } from "lucide-react";

type LeaderboardTipsDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const SLIDES = [
	{
		key: "ratings",
		title: (
			<h3 className={`flex gap-2 items-center`}>
				<ZapIcon className={`text-cyan-500`} />
				Prediction Rating
			</h3>
		),
		description: (
			<p>
				Ratings measure prediction skill, not points earned. Correct
				predictions increase your rating, and harder predictions are
				worth more
				<br />
				<br />
				Everyone starts at 1500.
			</p>
		),
	},
	{
		key: "points",
		title: (
			<h3 className={`flex gap-2 items-center`}>
				<CoinsIcon className={`text-rank-1`} />
				Points
			</h3>
		),
		description: (
			<p>
				Points track how many points you've won from predictions.
				<br />
				<br />
				Points determine your winnings. Prediction Rating measures your
				prediction skill.
			</p>
		),
	},
] as const;

export default function LeaderboardTipsDialog({
	open,
	onOpenChange,
}: Readonly<LeaderboardTipsDialogProps>) {
	return (
		<StepperTipsDialog
			open={open}
			onOpenChange={onOpenChange}
			dialogTitle='Leaderboard Tips'
			slides={SLIDES}
			nextLabel='Next'
			doneLabel='Done'
			previousLabel='Previous'
		/>
	);
}
