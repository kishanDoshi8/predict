import { useNotificationPermission } from "@/shared/hooks/useNotificationPermission";
import { useRoomActions } from "@/shared/lib/roomActions";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui";
import { BellIcon, Share2Icon } from "lucide-react";

// What a player can do while there's nothing to bet on yet: bring friends in,
// and make sure they hear when the next prediction opens.
export function RoomNextSteps({ className }: Readonly<{ className?: string }>) {
	const { openInvite, openNotifications } = useRoomActions();
	const { permission } = useNotificationPermission();

	return (
		<div className={cn("flex flex-wrap justify-center gap-2", className)}>
			<Button size='sm' variant='outline' className='text-foreground' onClick={openInvite}>
				<Share2Icon />
				Invite friends
			</Button>
			{permission !== "granted" ? (
				<Button size='sm' variant='outline' className='text-foreground' onClick={openNotifications}>
					<BellIcon />
					Turn on notifications
				</Button>
			) : null}
		</div>
	);
}
