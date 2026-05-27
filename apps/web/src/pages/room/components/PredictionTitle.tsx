import { Skeleton } from "@/components";
import { Prediction } from "@/types/Prediction";

type Props = {
	prediction: Prediction | null | undefined;
};

export default function PredictionTitle({ prediction }: Readonly<Props>) {
	return (
		<>
			{prediction ? (
				<h4 className={`text-xl md:text-3xl font-semibold text-center`}>
					{prediction.title}
				</h4>
			) : (
				<Skeleton className={`h-7 max-w-md w-full mx-auto`} />
			)}
		</>
	);
}
