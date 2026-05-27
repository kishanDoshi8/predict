import {
	Badge,
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components";
import { Clock, ZapIcon } from "lucide-react";
import { useEffect, useState } from "react";

type CountdownProps = {
	targetTime: number; // future timestamp in ms
	textSize?: string;
};

function formatTime(ms: number) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));

	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return [hours, minutes, seconds]
		.map((v) => String(v).padStart(2, "0"))
		.join(":");
}

export function Countdown({
	targetTime,
	textSize = "text-sm",
}: Readonly<CountdownProps>) {
	const [timeLeft, setTimeLeft] = useState(targetTime - Date.now());

	useEffect(() => {
		const interval = setInterval(() => {
			const diff = targetTime - Date.now();

			if (diff <= 0) {
				clearInterval(interval);
				setTimeLeft(0);
			} else {
				setTimeLeft(diff);
			}
		}, 1000);

		return () => clearInterval(interval);
	}, [targetTime]);

	return (
		<HoverCard openDelay={1000} closeDelay={100}>
			<HoverCardTrigger asChild>
				<div
					className={`flex flex-col items-center justify-center gap-1`}
				>
					<Badge
						className={`flex items-center gap-1.5 rounded-lg bg-secondary/80 px-3 py-1.5 font-mono ${textSize} font-bold text-rose-400`}
					>
						<ZapIcon />
						{timeLeft > 0 ? formatTime(timeLeft) : "00:00:00"}
					</Badge>
				</div>
			</HoverCardTrigger>
			<HoverCardContent>
				<p className={`text-sm text-muted-foreground`}>
					Time left until prediction closes
				</p>
			</HoverCardContent>
		</HoverCard>
	);
}
