import { Button } from "@/components";
import { Copy, CopyCheck } from "lucide-react";
import { useRoomContext } from "../RoomLayout";
import { useEffect, useState } from "react";
import { useBets } from "@/store/bet";
import { useActivePrediction } from "@/store/prediction";
import { RoomPreferencesDialog } from "./RoomPreferencesDialog";

export default function PredictionHeader() {
	const { room } = useRoomContext();
	const { data: activePrediction } = useActivePrediction(room.id);
	const { refetch: refetchBets } = useBets(room.id, activePrediction?.id);

	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (activePrediction) {
			refetchBets();
		}
	}, [activePrediction]);

	const handleCopyCode = () => {
		navigator.clipboard.writeText(room?.code ?? "");
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className={`p-4 flex justify-between items-center`}>
			<div>
				<p className={`text-muted-foreground text-sm md:text-base `}>
					ROOM CODE
				</p>
				<div
					className={`flex items-center gap-2 max-w-md w-full mx-auto`}
				>
					<h2
						className={`text-2xl md:text-4xl text-muted-foreground uppercase`}
					>
						{room.code}
					</h2>
					<Button
						variant='outline'
						size='sm'
						onClick={handleCopyCode}
					>
						{copied ? (
							<CopyCheck
								className={`text-primary text-sm cursor-none`}
							/>
						) : (
							<Copy
								className={`text-muted-foreground text-sm cursor-pointer`}
							/>
						)}
					</Button>
				</div>
			</div>
			<div className={`flex flex-col`}>
				<RoomPreferencesDialog roomId={room.id} />
			</div>
		</div>
	);
}
