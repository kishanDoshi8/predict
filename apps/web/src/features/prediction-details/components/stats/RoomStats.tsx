import { useRoomStatCards } from "@/entities/room/hooks/room";
import { useRoomContext } from "@/app/layouts/RoomLayout";
import { RoomStatRenderer } from "../RoomStatRenderer";
import { Skeleton } from "@/shared/ui";

function RoomStats() {
	const { room } = useRoomContext();
	const { data: roomStats = [], isPending } = useRoomStatCards(room.id);

	if (!isPending && roomStats.length === 0) {
		return null;
	}

	return (
		<section>
			{isPending ? (
				<div className='flex gap-3 overflow-x-auto pb-2'>
					{Array.from({ length: 3 }).map((_, index) => (
						<div
							key={index}
							className='min-w-45 flex-1 rounded-xl border bg-card p-3 space-y-2'
						>
							<Skeleton className='h-4 w-24' />
							<Skeleton className='h-6 w-28' />
							<Skeleton className='h-4 w-20' />
						</div>
					))}
				</div>
			) : (
				<div className='flex gap-3 overflow-x-auto pb-2'>
					{roomStats.map((stat) => (
						<RoomStatRenderer key={stat.key} stat={stat} />
					))}
				</div>
			)}
		</section>
	);
}

export default RoomStats;
