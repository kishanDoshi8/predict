import { PredictionHistoryFeed } from "../leaderboard/PredictionHistoryFeed";
import { usePredictionHistory } from "@/store/leaderboard";
import { useRoomContext } from "../RoomLayout";

function HistoryFeed() {
	const { room } = useRoomContext();
	const { data: history = [], isPending: isHistoryLoading } =
		usePredictionHistory(room.id);

	return (
		<div className={`flex flex-col gap-4 py-4 max-w-lg mx-auto w-full`}>
			{/* Section heading */}
			<div>
				<h2 className='text-lg font-semibold'>Blast from the Past</h2>
				<p className='text-sm text-muted-foreground'>
					Relive the glory (or agony) of previous predictions.
				</p>
			</div>

			<PredictionHistoryFeed
				entries={history}
				isLoading={isHistoryLoading}
			/>
		</div>
	);
}

export default HistoryFeed;
