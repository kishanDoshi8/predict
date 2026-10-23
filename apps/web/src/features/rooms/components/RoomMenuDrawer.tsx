import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/ui";
import {
	BellIcon,
	CircleQuestionMarkIcon,
	CopyIcon,
	Share2Icon,
	TrophyIcon,
	type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Room } from "@/features/rooms/types/types";

type Props = {
	room: Room;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onOpenNotifications: () => void;
	onOpenHowToPlay: () => void;
};

async function copyText(text: string, message: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(message, { position: "top-center" });
	} catch {
		toast.error("Couldn't copy. Long-press to copy instead.", {
			description: text,
			position: "top-center",
		});
	}
}

export function RoomMenuDrawer({
	room,
	open,
	onOpenChange,
	onOpenNotifications,
	onOpenHowToPlay,
}: Readonly<Props>) {
	const navigate = useNavigate();
	const inviteUrl = `${globalThis.location.origin}/rooms/${room.code}/join`;

	const close = (then: () => void) => () => {
		onOpenChange(false);
		then();
	};

	const handleInvite = async () => {
		if (navigator.share) {
			try {
				await navigator.share({
					title: `Join ${room.name} on Verdict`,
					text: `Join ${room.name} on Verdict. Room code ${room.code}.`,
					url: inviteUrl,
				});
				return;
			} catch {
				// Cancelled or unsupported: fall back to copying the link.
			}
		}
		await copyText(inviteUrl, "Invite link copied");
	};

	const items: Array<{ label: string; detail?: string; icon: LucideIcon; onClick: () => void }> = [
		{ label: "Invite friends", detail: "Share a link to join", icon: Share2Icon, onClick: close(() => void handleInvite()) },
		{ label: "Copy room code", detail: room.code, icon: CopyIcon, onClick: close(() => void copyText(room.code, "Room code copied")) },
		{ label: "Notifications", icon: BellIcon, onClick: close(onOpenNotifications) },
		{ label: "All series and past champions", icon: TrophyIcon, onClick: close(() => navigate(`/rooms/${room.code}/series`)) },
		{ label: "How to play", icon: CircleQuestionMarkIcon, onClick: close(onOpenHowToPlay) },
	];

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>{room.name}</DrawerTitle>
					<DrawerDescription>
						{room.members.length} member
						{room.members.length === 1 ? "" : "s"}
					</DrawerDescription>
				</DrawerHeader>
				<ul className='flex flex-col gap-1 px-4 pb-6'>
					{items.map(({ label, detail, icon: Icon, onClick }) => (
						<li key={label}>
							<button
								type='button'
								onClick={onClick}
								className='w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-accent/20'
							>
								<Icon className='size-5 text-muted-foreground' />
								<span className='flex-1'>{label}</span>
								{detail ? (
									<span className='text-sm text-muted-foreground tabular-nums'>
										{detail}
									</span>
								) : null}
							</button>
						</li>
					))}
				</ul>
			</DrawerContent>
		</Drawer>
	);
}
