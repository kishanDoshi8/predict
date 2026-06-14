import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function NotificationPermissionBlockedDialog({
	open,
	onOpenChange,
}: Readonly<Props>) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Notifications Disabled</DialogTitle>
					<DialogDescription>
						Notifications are blocked in your browser.
						<br />
						<br />
						To receive prediction updates and reminders, enable
						notifications from your browser settings and then return
						to the app.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant='outline' onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
