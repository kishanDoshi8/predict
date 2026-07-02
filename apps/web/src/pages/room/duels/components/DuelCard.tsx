import { Avatar, AvatarFallback } from "@/components";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/store/player";
import { Duel } from "@/types";
import { ChevronRightIcon, UsersIcon } from "lucide-react";
import { Link } from "react-router-dom";

type DuelCardProps = {
	duel: Duel;
};

const STATUS_LABEL: Record<Duel["status"], string> = {
	created: "Created",
	queued: "Queued",
	matched: "Matched",
	resolved: "Resolved",
	cancelled: "Cancelled",
	expired: "Expired",
};

export function DuelCard({ duel }: Readonly<DuelCardProps>) {
	const { data: player } = usePlayer();
	if (!player) return null;

	const isSelf = duel.challenger_player_id === player.id;
	const initials = duel.challenger_username
		? duel.challenger_username.slice(0, 2).toUpperCase()
		: "??";

	return (
		<div
			className={`rounded-xl border border-border bg-linear-to-br ${
				duel.status === "cancelled"
					? "from-destructive/15 border-destructive/50"
					: isSelf
						? "from-win/15 border-win/30"
						: "from-cyan-500/15"
			} to-card/20 p-4`}
		>
			<div className={`flex items-center gap-2`}>
				<Avatar size='lg' className={cn(isSelf && "ring-1 ring-win")}>
					<AvatarFallback className='text-xs'>
						{initials}
					</AvatarFallback>
				</Avatar>
				<div className={`flex-1`}>
					<p className='text-foreground font-semibold'>
						{duel.challenger_username ?? "Anonymous Challenger"}
					</p>
					<p
						className={`flex gap-1 items-center text-muted-foreground text-sm`}
					>
						<UsersIcon className={`h-3 w-3`} />
						<span>{duel.queue_count}</span>
						<span>queued</span>
					</p>
				</div>
				<div>
					<p
						className={`text-2xl font-semibold text-primary text-right`}
					>
						{duel.stake_amount.toLocaleString()}
					</p>
					<p className={`text-sm text-muted-foreground`}>STAKE</p>
				</div>
			</div>

			<div>
				<div
					className={`flex items-center p-2 mt-4 bg-card border rounded-lg`}
				>
					<p className='text-sm'>{STATUS_LABEL[duel.status]}</p>
					<Link
						to={duel.id}
						className={`flex items-center text-accent text-sm ml-auto`}
					>
						View Duel{" "}
						<ChevronRightIcon className={`w-4 h-4 ml-1`} />
					</Link>
				</div>
			</div>
		</div>
	);
}
