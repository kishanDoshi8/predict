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
	type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { Room } from "@/features/rooms/types/types";
import { SettingsRow } from "@/features/series/components/SeriesOrganizerActionsMenu";

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

	const items: Array<{
		label: string;
		detail?: string;
		icon: LucideIcon;
		onClick: () => void;
	}> = [
		{
			label: "Invite friends",
			icon: Share2Icon,
			onClick: close(() => void handleInvite()),
		},
		{
			label: "Copy room code",
			detail: room.code,
			icon: CopyIcon,
			onClick: close(() => void copyText(room.code, "Room code copied")),
		},
		// {
		// 	label: "All series and past champions",
		// 	icon: TrophyIcon,
		// 	onClick: close(() => navigate(`/rooms/${room.code}/series`)),
		// },
	];

	const settingsSectionItems: Array<{
		label: string;
		detail?: string;
		icon: LucideIcon;
		onClick: () => void;
	}> = [
		{
			label: "Notifications",
			icon: BellIcon,
			onClick: close(onOpenNotifications),
		},
	];

	const helpSectionItems: Array<{
		label: string;
		detail?: string;
		icon: LucideIcon;
		onClick: () => void;
	}> = [
		{
			label: "How to play",
			icon: CircleQuestionMarkIcon,
			onClick: close(onOpenHowToPlay),
		},
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
				<div className='flex flex-col gap-1 space-y-5 overflow-y-auto px-4 pb-4'>
					<ul>
						{items.map(({ label, detail, icon: Icon, onClick }) => (
							<li key={label}>
								<SettingsRow
									icon={
										<Icon className='size-5 text-muted-foreground' />
									}
									label={label}
									description={detail}
									onClick={onClick}
								/>
							</li>
						))}
					</ul>
					{settingsSectionItems.map(
						({ label, detail, icon: Icon, onClick }) => (
							<section className='space-y-2' key={label}>
								<p className='px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
									Settings
								</p>
								<SettingsRow
									icon={
										<Icon className='size-5 text-muted-foreground' />
									}
									label={label}
									description={detail}
									onClick={onClick}
								/>
							</section>
						),
					)}
					{helpSectionItems.map(
						({ label, detail, icon: Icon, onClick }) => (
							<section className='space-y-2' key={label}>
								<p className='px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
									Help
								</p>
								<SettingsRow
									icon={
										<Icon className='size-5 text-muted-foreground' />
									}
									label={label}
									description={detail}
									onClick={onClick}
								/>
							</section>
						),
					)}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
