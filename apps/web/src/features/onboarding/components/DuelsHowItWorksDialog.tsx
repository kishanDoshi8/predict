import StepperTipsDialog from "@/features/onboarding/components/StepperTipsDialog";

type DuelsHowItWorksDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const STEPS = [
	{
		key: "challenge",
		title: "⚔️ Challenge Players",
		description:
			"Pick a side. Face someone who picked the opposite. Winner takes the stake.",
	},
	{
		key: "jump-in",
		title: "🎯 Jump In",
		description:
			"Start or join a duel. Minimum prediction bet: 100 points.",
	},
	{
		key: "locked-in",
		title: "🔒 Locked In",
		description:
			"Your stake gets reserved. No sneaky spending it elsewhere.",
	},
	{
		key: "opponent-hunt",
		title: "🤝 Opponent Hunt",
		description:
			"You’re matched with someone on the opposite pick. No match? You get your points back.",
	},
	{
		key: "outcome",
		title: "🏆 Outcome",
		description:
			"Right pick wins both stakes. Wrong pick donates yours to science (aka the winner).",
	},
] as const;

export default function DuelsHowItWorksDialog({
	open,
	onOpenChange,
}: Readonly<DuelsHowItWorksDialogProps>) {
	return (
		<StepperTipsDialog
			open={open}
			onOpenChange={onOpenChange}
			dialogTitle='How Duels Work'
			slides={STEPS}
			nextLabel='Next'
			doneLabel='Done'
			previousLabel='Previous'
		/>
	);
}
