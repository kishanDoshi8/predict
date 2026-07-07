import {
	Badge,
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/shared/ui";
import { ZapIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CountdownProps = {
	targetTime: number; // future timestamp in ms
	textSize?: string;
	onExpire?: () => void;
	hideIcon?: boolean;
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

function formatDateTime(timestamp: number) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(timestamp);
}

export function Countdown({
	targetTime,
	textSize = "text-sm",
	onExpire,
	hideIcon = false,
}: Readonly<CountdownProps>) {
	const [timeLeft, setTimeLeft] = useState(targetTime - Date.now());
	const hasExpiredRef = useRef(false);
	const showDateTime = timeLeft > 13 * 60 * 60 * 1000;
	let displayValue = "00:00:00";
	if (timeLeft > 0) {
		displayValue = showDateTime
			? formatDateTime(targetTime)
			: formatTime(timeLeft);
	}

	useEffect(() => {
		hasExpiredRef.current = false;

		const updateCountdown = () => {
			const diff = targetTime - Date.now();

			if (diff <= 0) {
				setTimeLeft(0);
				if (!hasExpiredRef.current && onExpire) {
					hasExpiredRef.current = true;
					onExpire();
				}
			} else {
				setTimeLeft(diff);
			}
		};

		updateCountdown();
		const interval = setInterval(updateCountdown, 1000);

		return () => clearInterval(interval);
	}, [targetTime, onExpire]);

	return (
		<HoverCard openDelay={1000} closeDelay={100}>
			<HoverCardTrigger asChild>
				<div
					className={`flex flex-col items-center justify-center gap-1`}
				>
					<Badge
						className={`flex items-center gap-1.5 rounded-lg bg-secondary/80 px-3 py-1.5 font-mono ${textSize} font-bold text-rose-400`}
					>
						{!hideIcon && <ZapIcon />}
						{displayValue}
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
