import type { Series } from "@/features/series/types/series";
import {
	Button,
	Checkbox,
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldTitle,
} from "@/shared/ui";
import {
	ArchiveIcon,
	BellIcon,
	CalendarDaysIcon,
	MegaphoneIcon,
	PencilIcon,
	SettingsIcon,
	ShieldAlertIcon,
	TrophyIcon,
	UsersIcon,
	UserPlusIcon,
	WrenchIcon,
	GiftIcon,
	CheckCircle2Icon,
	LockIcon,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

type SeriesOrganizerActionsMenuProps = {
	series: Series;
	isPending: boolean;
	onEdit: () => void;
	onArchive: () => void;
	onCloseSeries: () => void;
};

type SettingsRowProps = {
	icon: ReactNode;
	label: string;
	description?: string;
	disabled?: boolean;
	onClick?: () => void;
	isDanger?: boolean;
};

function SettingsRow({
	icon,
	label,
	description,
	disabled = false,
	onClick,
	isDanger = false,
}: Readonly<SettingsRowProps>) {
	return (
		<Button
			variant='ghost'
			className={`h-auto w-full justify-start rounded-xl px-3 py-3 text-left ${
				disabled ? "opacity-50" : ""
			}`}
			disabled={disabled}
			onClick={onClick}
		>
			<div className='mr-3 mt-0.5'>{icon}</div>
			<div className='flex-1 space-y-0.5'>
				<p
					className={`text-sm font-medium ${isDanger ? "text-destructive" : "text-foreground"}`}
				>
					{label}
				</p>
				{description ? (
					<p className='text-xs text-muted-foreground'>
						{description}
					</p>
				) : null}
			</div>
		</Button>
	);
}

export function SeriesOrganizerActionsMenu({
	series,
	isPending,
	onEdit,
	onArchive,
	onCloseSeries,
}: Readonly<SeriesOrganizerActionsMenuProps>) {
	const [isManageOpen, setIsManageOpen] = useState(false);
	const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
	const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
	const [archiveAcknowledged, setArchiveAcknowledged] = useState(false);
	const [closeAcknowledged, setCloseAcknowledged] = useState(false);

	const isClosed = useMemo(
		() => series.status === "completed" || series.status === "archived",
		[series.status],
	);

	const disableEditableRows = isPending || isClosed;

	const openArchiveConfirmation = () => {
		setArchiveAcknowledged(false);
		setIsArchiveConfirmOpen(true);
	};

	const openCloseConfirmation = () => {
		setCloseAcknowledged(false);
		setIsCloseConfirmOpen(true);
	};

	const handleArchiveConfirm = () => {
		onArchive();
		setIsArchiveConfirmOpen(false);
		setIsManageOpen(false);
	};

	const handleCloseConfirm = () => {
		onCloseSeries();
		setIsCloseConfirmOpen(false);
		setIsManageOpen(false);
	};

	return (
		<>
			<Drawer open={isManageOpen} onOpenChange={setIsManageOpen}>
				<DrawerTrigger asChild>
					<Button variant='ghost' size='icon'>
						<SettingsIcon className='size-5' />
					</Button>
				</DrawerTrigger>
				<DrawerContent className='data-[vaul-drawer-direction=bottom]:right-auto data-[vaul-drawer-direction=bottom]:left-1/2 data-[vaul-drawer-direction=bottom]:w-full data-[vaul-drawer-direction=bottom]:max-w-md data-[vaul-drawer-direction=bottom]:-translate-x-1/2'>
					<DrawerHeader className='text-left'>
						<DrawerTitle>Manage series</DrawerTitle>
						<DrawerDescription>{series.title}</DrawerDescription>
					</DrawerHeader>

					<div className='space-y-5 overflow-y-auto px-4 pb-4'>
						{isClosed ? (
							<div className='rounded-xl border border-border bg-muted/40 p-3'>
								<p className='text-sm text-muted-foreground'>
									This series is closed. Results are final and
									it can no longer be edited.
								</p>
							</div>
						) : null}

						<section className='space-y-2'>
							<p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
								Series
							</p>
							<SettingsRow
								icon={
									<PencilIcon className='size-4 text-muted-foreground' />
								}
								label='Edit details'
								description='Title, Description, # games'
								disabled={disableEditableRows}
								onClick={onEdit}
							/>
							<SettingsRow
								icon={
									<CalendarDaysIcon className='size-4 text-muted-foreground' />
								}
								label='Schedule & games'
								description='Coming soon.'
								disabled
							/>
							<SettingsRow
								icon={
									<TrophyIcon className='size-4 text-muted-foreground' />
								}
								label='Scoring rules'
								description='Coming soon.'
								disabled
							/>
						</section>

						<section className='space-y-2'>
							<p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
								Participants
							</p>
							<SettingsRow
								icon={
									<UserPlusIcon className='size-4 text-muted-foreground' />
								}
								label='Invite players'
								disabled
							/>
							<SettingsRow
								icon={
									<UsersIcon className='size-4 text-muted-foreground' />
								}
								label='Manage members'
								disabled
							/>
							<SettingsRow
								icon={
									<MegaphoneIcon className='size-4 text-muted-foreground' />
								}
								label='Post announcements'
								disabled
							/>
							<SettingsRow
								icon={
									<BellIcon className='size-4 text-muted-foreground' />
								}
								label='Share link'
								disabled
							/>
						</section>

						<section className='space-y-2'>
							<p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
								Danger zone
							</p>
							<SettingsRow
								icon={
									<ArchiveIcon className='size-4 text-muted-foreground' />
								}
								label='Archive series'
								description='Irreversible in this UI.'
								onClick={openArchiveConfirmation}
								disabled
							/>
							<SettingsRow
								icon={
									<WrenchIcon className='size-4 text-destructive' />
								}
								label='Close series'
								description='Locks this series permanently.'
								disabled={disableEditableRows}
								onClick={openCloseConfirmation}
								isDanger
							/>
						</section>
					</div>
				</DrawerContent>
			</Drawer>

			<Drawer
				open={isArchiveConfirmOpen}
				onOpenChange={setIsArchiveConfirmOpen}
			>
				<DrawerContent className='data-[vaul-drawer-direction=bottom]:right-auto data-[vaul-drawer-direction=bottom]:left-1/2 data-[vaul-drawer-direction=bottom]:w-full data-[vaul-drawer-direction=bottom]:max-w-md data-[vaul-drawer-direction=bottom]:-translate-x-1/2'>
					<DrawerHeader className='text-left'>
						<DrawerTitle>Archive series</DrawerTitle>
						<DrawerDescription>
							Archive {series.title} and hide it from active
							workflows.
						</DrawerDescription>
					</DrawerHeader>
					<div className='space-y-4 px-4'>
						<div className='rounded-xl border border-destructive/40 bg-destructive/10 p-3'>
							<p className='flex items-start gap-2 text-sm text-destructive'>
								<ShieldAlertIcon className='mt-0.5 size-4 shrink-0' />
								This action is irreversible in this UI.
							</p>
						</div>
						<div className='rounded-xl border p-3'>
							<p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
								What happens
							</p>
							<ul className='mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground'>
								<li>Series is moved to archived state.</li>
								<li>It is hidden from active room flows.</li>
								<li>Settings remain read-only.</li>
							</ul>
						</div>
						<FieldLabel>
							<Field orientation='horizontal'>
								<Checkbox
									id='toggle-checkbox-2'
									name='toggle-checkbox-2'
									checked={closeAcknowledged}
									onCheckedChange={(checked) =>
										setCloseAcknowledged(checked === true)
									}
									disabled={isPending}
								/>
								<FieldContent>
									<FieldTitle>Archive series</FieldTitle>
									<FieldDescription>
										I understand this archive action is
										irreversible.
									</FieldDescription>
								</FieldContent>
							</Field>
						</FieldLabel>
					</div>
					<DrawerFooter>
						<DrawerClose asChild>
							<Button variant='outline' disabled={isPending}>
								Cancel
							</Button>
						</DrawerClose>
						<Button
							variant='destructive'
							onClick={handleArchiveConfirm}
							disabled={isPending || !archiveAcknowledged}
						>
							Archive series
						</Button>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>

			<Drawer
				open={isCloseConfirmOpen}
				onOpenChange={setIsCloseConfirmOpen}
			>
				<DrawerContent className='data-[vaul-drawer-direction=bottom]:right-auto data-[vaul-drawer-direction=bottom]:left-1/2 data-[vaul-drawer-direction=bottom]:w-full data-[vaul-drawer-direction=bottom]:max-w-md data-[vaul-drawer-direction=bottom]:-translate-x-1/2'>
					<DrawerHeader className='text-left'>
						<DrawerTitle>Close series</DrawerTitle>
					</DrawerHeader>
					<div className='space-y-4 px-4'>
						<div className='rounded-xl border border-destructive/40 bg-destructive/10 p-3'>
							<p className='flex items-start gap-2 text-sm text-destructive'>
								<ShieldAlertIcon className='mt-0.5 size-4 shrink-0' />
								Closing {series.title} is permanent. This cannot
								be undone and the series can never be reopened.
							</p>
						</div>
						<div className='rounded-xl border p-3'>
							<p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
								What happens
							</p>
							<ul className='mt-2 list-none space-y-1 text-sm text-muted-foreground'>
								<li>
									<GiftIcon className='size-4 inline-block mr-2 text-accent' />
									Rewards are distributed to winners.
								</li>
								<li>
									<CheckCircle2Icon className='size-4 inline-block mr-2 text-accent' />
									Final standings are locked.
								</li>
								<li>
									<LockIcon className='size-4 inline-block mr-2 text-accent' />
									Predictions and settings become read-only.
								</li>
							</ul>
						</div>
						<FieldLabel>
							<Field orientation='horizontal'>
								<Checkbox
									id='toggle-checkbox-2'
									name='toggle-checkbox-2'
									checked={closeAcknowledged}
									onCheckedChange={(checked) =>
										setCloseAcknowledged(checked === true)
									}
									disabled={isPending}
								/>
								<FieldContent>
									<FieldTitle>Close series</FieldTitle>
									<FieldDescription>
										I understand this will permanently close
										the series.
									</FieldDescription>
								</FieldContent>
							</Field>
						</FieldLabel>
					</div>
					<DrawerFooter>
						<DrawerClose asChild>
							<Button variant='outline' disabled={isPending}>
								Cancel
							</Button>
						</DrawerClose>
						<Button
							variant='destructive'
							onClick={handleCloseConfirm}
							disabled={isPending || !closeAcknowledged}
						>
							Close series
						</Button>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		</>
	);
}
