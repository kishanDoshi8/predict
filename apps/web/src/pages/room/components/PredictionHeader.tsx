import { Button } from "@/components";
import { Copy, CopyCheck, TrophyIcon } from "lucide-react";
import { useRoomContext } from "../RoomLayout";
import { useState } from "react";
import { RoomPreferencesDialog } from "./RoomPreferencesDialog";
import { Link } from "react-router-dom";

export default function PredictionHeader() {
	const { room } = useRoomContext();

	const [copied, setCopied] = useState(false);

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
			<div className={`flex gap-4`}>
				<RoomPreferencesDialog roomId={room.id} />
				<Link to={`/rooms/${room.code}/leaderboard`}>
					<Button
						variant='secondary'
						size='icon-lg'
						className={`rounded-full`}
					>
						<TrophyIcon />
					</Button>
				</Link>
			</div>
		</div>
	);
}
