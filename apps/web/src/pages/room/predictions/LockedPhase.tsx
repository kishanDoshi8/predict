import { Badge, Skeleton } from "@/components";
import { Prediction } from "@/types";
import PredictionTitle from "../components/PredictionTitle";
import PredictionOptions from "../widgets/PredictionOptions";
import { useRoomContext } from "../RoomLayout";
import { useBets } from "@/store/bet";
import { useEffect } from "react";
import { usePlayer } from "@/store/player";
import { useOptionColor } from "@/hooks/useOptionColor";
import { ClockIcon, LockIcon } from "lucide-react";
import LockControls from "../controls/LockControls";
import { useRoomBetRealtime } from "@/hooks/useRoomRealtime";
import PredictionData from "./PredictionData";

type Props = {
	prediction: Prediction | null | undefined;
	selectedOption: string | null;
};

export default function LockedPhase({
	prediction,
	selectedOption,
}: Readonly<Props>) {
	const { room } = useRoomContext();
	const { data: player } = usePlayer();
	const {
		data: bets,
		isLoading: isBetsLoading,
		refetch: refetchBets,
	} = useBets(room.id, prediction?.id);

	useRoomBetRealtime(room.id, prediction?.id ?? null);

	useEffect(() => {
		if (prediction) {
			refetchBets();
		}
	}, [prediction]);

	const getPlayerName = (playerId: string) => {
		if (player?.id === playerId) {
			return player.username + " (You)";
		}
		const member = room.members.find((m) => m.player_id === playerId);
		return member ? member.player.username : "Unknown";
	};

	return (
		<div className={`flex-1 flex flex-col gap-4 items-center pb-4`}>
			<div
				className={`flex flex-col gap-4 justify-center w-full max-w-md mx-auto relative overflow-hidden rounded-2xl bg-linear-to-br from-accent-500/15 via-card to-primary-500/10 border border-orange-500/20 p-5`}
			>
				{prediction?.status === "locked" ? (
					<Badge
						className={`mx-auto bg-accent/25 text-accent font-semibold`}
					>
						<LockIcon className={`w-3 h-3 mr-2`} />
						BETS CLOSED
					</Badge>
				) : (
					<Skeleton className={`h-5 w-25 mx-auto`} />
				)}

				<PredictionTitle prediction={prediction} />

				{prediction ? (
					<Badge
						className={`mx-auto py-2 rounded-md bg-secondary/70 text-base text-accent/70`}
					>
						<ClockIcon
							className={`w-5! h-5! text-accent mr-1 animate-pulse`}
						/>
						Awaiting Results
					</Badge>
				) : (
					<Skeleton className={`h-10 w-36 mx-auto`} />
				)}

				<PredictionData prediction={prediction} />

				<PredictionOptions
					prediction={prediction}
					selectedOption={selectedOption}
					setSelectedOption={() => {}}
				/>
			</div>

			<div className={`max-w-md w-full mx-auto mt-4`}>
				<div className={`flex mb-2`}>
					<p className={`text-2xl`}>Who bet what?</p>
				</div>
				{isBetsLoading ? (
					<>
						<Skeleton className={`h-15 w-full mx-auto mt-4`} />
						<Skeleton className={`h-15 w-full mx-auto mt-4`} />
					</>
				) : (
					<div
						className={`rounded-xl overflow-hidden border border-border`}
					>
						{bets?.map((bet) => (
							<div
								key={bet.id}
								className={`flex justify-between border-b border-secondary bg-card hover:bg-secondary p-4`}
							>
								<div>
									<p>{getPlayerName(bet.player_id)}</p>
									<p>{}</p>
								</div>
								<div>
									<p>{bet.amount} PTS</p>
									<p
										className={`text-sm text-right ${useOptionColor(bet.option?.id ?? "")}`}
									>
										on {bet.option?.label ?? "Unknown"}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{prediction && <LockControls prediction={prediction} />}
		</div>
	);
}
