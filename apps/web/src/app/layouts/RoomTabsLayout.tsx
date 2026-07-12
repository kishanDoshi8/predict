import { Outlet } from "react-router-dom";
import {
	RoomBottomNavigation,
	RoomFloatingActionButton,
} from "@/features/rooms/components";

export default function RoomTabsLayout() {
	return (
		<div className='flex-1 flex flex-col'>
			<div className='flex-1 pb-24'>
				<Outlet />
			</div>
			<RoomFloatingActionButton />
			<RoomBottomNavigation />
		</div>
	);
}
