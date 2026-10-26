import { FadeContent, Skeleton } from "@/shared/ui";
import { Prediction } from "@/features/predictions";

type Props = {
	prediction: Prediction | null | undefined;
	fadeDelay?: number;
};

export default function PredictionTitle({
	prediction,
	fadeDelay,
}: Readonly<Props>) {
	return (
		<>
			{prediction ? (
				<FadeContent delay={fadeDelay}>
					<h4
						className={`text-xl md:text-3xl font-semibold text-center`}
					>
						{prediction.title}
					</h4>
				</FadeContent>
			) : (
				// Holds the heading's line height (text-xl, md:text-3xl).
				<div className={`flex h-7 md:h-9 items-center justify-center`}>
					<Skeleton className={`h-5 md:h-7 max-w-xs w-3/4`} />
				</div>
			)}
		</>
	);
}
