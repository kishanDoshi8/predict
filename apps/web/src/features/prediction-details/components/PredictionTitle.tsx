import { FadeContent, Skeleton } from "@/shared/ui";
import { Prediction } from "@/entities/prediction/model/types";

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
				<Skeleton className={`h-7 max-w-md w-full mx-auto`} />
			)}
		</>
	);
}
