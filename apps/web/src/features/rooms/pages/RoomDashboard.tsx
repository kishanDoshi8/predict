import { InPlayPredictions, UserStats } from "@/features/predictions";

function RoomDashboard() {
	return (
		<div className={`px-4`}>
			<div className={`mt-2`}>
				<InPlayPredictions />
			</div>

			<div className={`mt-6`}>
				<UserStats />
			</div>
		</div>
	);
}

export default RoomDashboard;
