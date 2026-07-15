import { useRoomContext } from "@/app/layouts/RoomLayout";
import { cn } from "@/shared/lib/utils";
import {
	ActivitySquareIcon,
	HistoryIcon,
	LayoutDashboardIcon,
	TrophyIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
	{
		label: "Dashboard",
		segment: "",
		icon: LayoutDashboardIcon,
	},
	{
		label: "Leaderboard",
		segment: "leaderboard",
		icon: TrophyIcon,
	},
	{
		label: "History",
		segment: "history",
		icon: HistoryIcon,
	},
	{
		label: "Activities",
		segment: "activities",
		icon: ActivitySquareIcon,
	},
] as const;

export function RoomBottomNavigation() {
	const { room } = useRoomContext();

	return (
		<nav
			className='fixed bottom-0 left-0 right-0 z-40 backdrop-blur-sm'
			style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
			aria-label='Room navigation'
		>
			<div className='max-w-md mx-auto w-full bg-card/80 border border-t rounded-t-lg'>
				<ul className='flex justify-around h-16'>
					{navItems.map(({ label, segment, icon: Icon }) => {
						const to = segment
							? `/rooms/${room.code}/${segment}`
							: `/rooms/${room.code}`;

						return (
							<li key={label}>
								<NavLink
									to={to}
									end={segment.length === 0}
									className={({ isActive }) =>
										cn(
											"relative w-full h-full flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
											isActive && "text-primary",
										)
									}
								>
									<Icon size={18} />
									{segment === "activities" &&
									room.has_unseen_activities ? (
										<span
											className='absolute top-5 -right-1 h-3 w-3 rounded-full bg-destructive border-2 border-card'
											aria-hidden='true'
										/>
									) : null}
									{/* <span>{label}</span> */}
								</NavLink>
							</li>
						);
					})}
				</ul>
			</div>
		</nav>
	);
}
