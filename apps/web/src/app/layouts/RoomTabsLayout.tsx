import { Outlet, useOutletContext } from "react-router-dom";
import {
	RoomBottomNavigation,
	RoomFloatingActionButton,
} from "@/features/rooms/components";
import type { RoomOutletContext } from "@/app/layouts/RoomLayout";

export default function RoomTabsLayout() {
	const context = useOutletContext<RoomOutletContext>();

	return (
		<div className='flex-1 flex flex-col'>
			<div className='flex-1 pb-24'>
				<Outlet context={context} />
			</div>
			<RoomFloatingActionButton />
			<RoomBottomNavigation />
		</div>
	);
}
