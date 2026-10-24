import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/ui";
import {
	BellIcon,
	CopyIcon,
	LinkIcon,
	LogOutIcon,
	Share2Icon,
	type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Room } from "@/features/rooms/types/types";
import { SettingsRow } from "@/features/series/components/SeriesOrganizerActionsMenu";
import { useAuth } from "@/features/auth";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { InviteSheet, inviteUrlFor } from "./InviteSheet";

type Props = {
	room: Room;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onOpenNotifications: () => void;
};

export function RoomMenuDrawer({
	room,
	open,
	onOpenChange,
	onOpenNotifications,
}: Readonly<Props>) {
	const navigate = useNavigate();
	const { user, hasGoogleIdentity, linkGoogle, signOut } = useAuth();
	const [isInviteSheetOpen, setIsInviteSheetOpen] = useState(false);
	const inviteUrl = inviteUrlFor(room);

	const close = (then: () => void) => () => {
		onOpenChange(false);
		then();
	};

	// Share sheet first; if the phone has none (or sharing fails), show the
	// Invite sheet with the link and copy buttons. Dismissing the share sheet
	// is not an error.
	const handleInvite = async () => {
		if (navigator.share) {
			try {
				await navigator.share({
					title: `Join ${room.name} on Verdict`,
					text: `Join ${room.name} on Verdict. Room code ${room.code}.`,
					url: inviteUrl,
				});
				return;
			} catch (error) {
				if (
					error instanceof DOMException &&
					error.name === "AbortError"
				)
					return;
			}
		}
		setIsInviteSheetOpen(true);
	};

	const handleCopyCode = async () => {
		if (await copyToClipboard(room.code)) {
			toast.success("Room code copied", { position: "top-center" });
		} else {
			setIsInviteSheetOpen(true);
		}
	};

	const handleConnectGoogle = async () => {
		try {
			await linkGoogle();
		} catch (error) {
			toast.error("Couldn't connect Google.", {
				description: error instanceof Error ? error.message : undefined,
				position: "top-center",
			});
		}
	};

	const handleSignOut = async () => {
		try {
			await signOut();
			navigate("/login", { replace: true });
		} catch (error) {
			toast.error("Couldn't sign out. Try again.", {
				description: error instanceof Error ? error.message : undefined,
				position: "top-center",
			});
		}
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
			onClick: close(() => void handleCopyCode()),
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

	const accountSectionItems: Array<{
		label: string;
		detail?: string;
		icon: LucideIcon;
		onClick: () => void;
		isDanger?: boolean;
	}> = [
		...(hasGoogleIdentity
			? []
			: [
					{
						label: "Connect Google",
						detail: "Sign in with Google next time",
						icon: LinkIcon,
						onClick: close(() => void handleConnectGoogle()),
					},
				]),
		{
			label: "Sign out",
			detail: user?.email ?? undefined,
			icon: LogOutIcon,
			onClick: close(() => void handleSignOut()),
			isDanger: true,
		},
	];

	return (
		<>
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
							{items.map(
								({ label, detail, icon: Icon, onClick }) => (
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
								),
							)}
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
						<section className='space-y-2'>
							<p className='px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
								Account
							</p>
							{accountSectionItems.map(
								({
									label,
									detail,
									icon: Icon,
									onClick,
									isDanger,
								}) => (
									<SettingsRow
										key={label}
										icon={
											<Icon className='size-5 text-muted-foreground' />
										}
										isDanger={isDanger}
										label={label}
										description={detail}
										onClick={onClick}
									/>
								),
							)}
						</section>
					</div>
				</DrawerContent>
			</Drawer>
			<InviteSheet
				room={room}
				open={isInviteSheetOpen}
				onOpenChange={setIsInviteSheetOpen}
			/>
		</>
	);
}
