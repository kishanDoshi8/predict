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
	FlagIcon,
	LinkIcon,
	LogOutIcon,
	SettingsIcon,
	Share2Icon,
	UsersIcon,
	type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Room } from "@/features/rooms/types/types";
import { SettingsRow } from "@/features/series/components/SeriesOrganizerActionsMenu";
import { useAuth } from "@/features/auth";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { InviteSheet } from "./InviteSheet";
import { useManageQueue } from "@/features/rooms/hooks/staff";
import { useRoomRole } from "@/features/rooms/hooks/useRoomRole";
import { useCurrentSeries, useSeriesWallet } from "@/features/series/hooks/wallets";
import {
	InviteCard,
	shareHost,
	shareLink,
	ShareSheet,
	type InviteCardData,
} from "@/features/share";
import { useActivePredictions } from "@/features/predictions/hooks/prediction";
import { useBets } from "@/features/predictions/hooks/bet";
import { describeDeadline } from "@/shared/lib/deadline";

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
	const [isInviteCardOpen, setIsInviteCardOpen] = useState(false);
	const { can } = useRoomRole(room);
	const { data: manageQueue } = useManageQueue(room.id, can.resolve && open);
	const { currentSeries } = useCurrentSeries(room.id);
	const activeSeries = currentSeries?.status === "active" ? currentSeries : null;
	const { wallet: activeWallet } = useSeriesWallet(room.id, activeSeries?.id);

	// The open prediction that locks soonest, shown on the invite card. Only
	// fetched once the card is open.
	const { data: activePredictions = [] } = useActivePredictions(
		room.id,
		activeSeries?.id,
		isInviteCardOpen && !!activeSeries,
	);
	const now = Date.now();
	const nextLock = activePredictions
		.filter(
			(prediction) =>
				prediction.status === "draft" &&
				new Date(prediction.deadline).getTime() > now,
		)
		.sort(
			(a, b) =>
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
		)[0];
	const { data: nextLockBets = [] } = useBets(room.id, nextLock?.id);
	const nextLockPool = nextLockBets.reduce((sum, bet) => sum + bet.amount, 0);

	const inviteCard: InviteCardData = {
		roomName: room.name,
		roomCode: room.code,
		host: shareHost(),
		memberCount: room.member_count ?? room.members.length,
		livePredictions: room.active_prediction_count ?? 0,
		series:
			activeSeries && activeWallet
				? { title: activeSeries.title, startingStack: activeWallet.starting_stack }
				: null,
		teaser: nextLock
			? {
					question: nextLock.title,
					locks: describeDeadline(new Date(nextLock.deadline)).when,
					options: nextLock.prediction_options.map((option) => ({
						label: option.label,
						share:
							nextLockPool > 0
								? (nextLockBets
										.filter((bet) => bet.option_id === option.id)
										.reduce((sum, bet) => sum + bet.amount, 0) /
										nextLockPool) *
									100
								: 0,
					})),
				}
			: null,
	};

	const close = (then: () => void) => () => {
		onOpenChange(false);
		then();
	};

	// The invite card image with the link; copying the link or code stays in the
	// Invite sheet.
	const handleInvite = () => setIsInviteCardOpen(true);

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

	const toResolveCount = manageQueue?.to_resolve.length ?? 0;
	// Staff tools first; everyone can see who's in the room and their roles.
	const roomSectionItems: Array<{
		label: string;
		detail?: string;
		icon: LucideIcon;
		onClick: () => void;
	}> = [
		...(can.resolve
			? [
					{
						label: "Needs you",
						detail:
							toResolveCount > 0
								? `${toResolveCount} ${toResolveCount === 1 ? "result" : "results"} to reveal`
								: "Nothing waiting on a result",
						icon: FlagIcon,
						onClick: close(() => navigate(`/rooms/${room.code}/manage`)),
					},
				]
			: []),
		{
			label: can.own ? "Members & roles" : "Members",
			icon: UsersIcon,
			onClick: close(() => navigate(`/rooms/${room.code}/members`)),
		},
		...(can.own
			? [
					{
						label: "Room settings",
						detail: "Name, open predictions limit, result reminders",
						icon: SettingsIcon,
						onClick: close(() => navigate(`/rooms/${room.code}/settings`)),
					},
				]
			: []),
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
						<MenuSection title='Room' items={roomSectionItems} />
						<MenuSection title='Settings' items={settingsSectionItems} />
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
			<ShareSheet
				open={isInviteCardOpen}
				onOpenChange={setIsInviteCardOpen}
				title={`Invite friends to ${room.name}`}
				description='Anyone with the link can join after signing in.'
				message={`Join ${room.name} on Verdict. Room code ${room.code}.`}
				link={shareLink(room.code, "invite-card")}
				kind='invite-card'
				roomId={room.id}
				fileName={`verdict-invite-${room.code.toLowerCase()}`}
				renderCard={(format) => <InviteCard data={inviteCard} format={format} />}
			/>
		</>
	);
}

function MenuSection({
	title,
	items,
}: Readonly<{
	title: string;
	items: Array<{
		label: string;
		detail?: string;
		icon: LucideIcon;
		onClick: () => void;
	}>;
}>) {
	return (
		<section className='space-y-2'>
			<p className='px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
				{title}
			</p>
			{items.map(({ label, detail, icon: Icon, onClick }) => (
				<SettingsRow
					key={label}
					icon={<Icon className='size-5 text-muted-foreground' />}
					label={label}
					description={detail}
					onClick={onClick}
				/>
			))}
		</section>
	);
}
