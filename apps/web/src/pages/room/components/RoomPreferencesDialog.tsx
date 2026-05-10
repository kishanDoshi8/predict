import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Spinner,
} from "@/components";
import {
	PreferenceSettings,
	RoomPreferenceOverrides,
	sendPushNotificationTrigger,
} from "@/lib/api";
import {
	usePreferences,
	useResetRoomPreferences,
	useUpdateGlobalPreferences,
	useUpdateRoomPreferences,
} from "@/store/preferences";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

type Props = {
	roomId: string;
};

type NotificationPreferenceKey =
	| "prediction_live"
	| "prediction_locked"
	| "deadline_1h"
	| "result_revealed"
	| "weekly_points_claim";

const notificationLabels: Record<NotificationPreferenceKey, string> = {
	prediction_live: "Prediction goes live",
	prediction_locked: "Prediction locked",
	deadline_1h: "Betting deadline (1h)",
	result_revealed: "Result revealed",
	weekly_points_claim: "Weekly points claim available",
};

const notificationKeys: NotificationPreferenceKey[] = [
	"prediction_live",
	"prediction_locked",
	"deadline_1h",
	"result_revealed",
	"weekly_points_claim",
];

const cycleOverride = (value: boolean | null): boolean | null => {
	if (value === null) return true;
	if (value === true) return false;
	return null;
};

const overrideLabel = (value: boolean | null) => {
	if (value === null) return "Inherited";
	return value ? "On" : "Off";
};

const overrideVariant = (
	value: boolean | null,
): "default" | "outline" | "secondary" => {
	if (value === null) return "secondary";
	return value ? "default" : "outline";
};

const getErrorMessage = (error: unknown) =>
	error instanceof Error ? error.message : "Unexpected error";

export function RoomPreferencesDialog({ roomId }: Readonly<Props>) {
	const [isSendingTestPush, setIsSendingTestPush] = useState(false);
	const { data: preferences, isPending: isPreferencesPending } =
		usePreferences(roomId);
	const { mutate: updateGlobal, isPending: isUpdatingGlobal } =
		useUpdateGlobalPreferences(roomId);
	const { mutate: updateRoom, isPending: isUpdatingRoom } =
		useUpdateRoomPreferences(roomId);
	const { mutate: resetRoom, isPending: isResettingRoom } =
		useResetRoomPreferences(roomId);

	const handleGlobalToggle = (key: NotificationPreferenceKey) => {
		if (!preferences) return;

		const nextGlobal: PreferenceSettings = {
			...preferences.global,
			[key]: !preferences.global[key],
			dark_mode: true,
		};

		updateGlobal(nextGlobal, {
			onError: (error) => {
				toast.error("Failed to update global preference.", {
					description: getErrorMessage(error),
					duration: 6000,
					position: "top-center",
				});
			},
		});
	};

	const handleRoomCycle = (key: NotificationPreferenceKey) => {
		if (!preferences) return;

		const nextOverrides: RoomPreferenceOverrides = {
			...preferences.room_overrides,
			[key]: cycleOverride(preferences.room_overrides[key]),
		};

		updateRoom(nextOverrides, {
			onError: (error) => {
				toast.error("Failed to update room override.", {
					description: getErrorMessage(error),
					duration: 6000,
					position: "top-center",
				});
			},
		});
	};

	const handleResetRoom = () => {
		resetRoom(undefined, {
			onError: (error) => {
				toast.error("Failed to reset room overrides.", {
					description: getErrorMessage(error),
					duration: 6000,
					position: "top-center",
				});
			},
		});
	};

	const isBusy =
		isPreferencesPending ||
		isUpdatingGlobal ||
		isUpdatingRoom ||
		isResettingRoom;

	const handleSendTestPush = async () => {
		const playerToken = localStorage.getItem("predikt") ?? "";
		if (!playerToken) {
			toast.error("Missing player session.");
			return;
		}

		try {
			setIsSendingTestPush(true);
			const response = await sendPushNotificationTrigger({
				event_type: "prediction_live",
				payload: {
					title: "Predikt test notification",
					body: "Push notifications are configured for your account.",
					url: window.location.pathname,
				},
				target_player_token: playerToken,
			});

			toast.success("Test notification request sent.", {
				description: `Delivered: ${response.sent_count}, failed: ${response.failed_count}`,
				position: "top-center",
			});
		} catch (error) {
			toast.error("Failed to send test notification.", {
				description: getErrorMessage(error),
				position: "top-center",
			});
		} finally {
			setIsSendingTestPush(false);
		}
	};

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant='outline' size='sm'>
					<Settings2 />
				</Button>
			</DialogTrigger>
			<DialogContent className='sm:max-w-xl'>
				<DialogHeader>
					<DialogTitle>Room Preferences</DialogTitle>
					<DialogDescription>
						Global defaults apply everywhere. This room can override
						each notification.
					</DialogDescription>
				</DialogHeader>

				{!preferences || isPreferencesPending ? (
					<div className='py-8 flex justify-center'>
						<Spinner className='size-8' />
					</div>
				) : (
					<div className='-mx-4 no-scrollbar max-h-[50vh] overflow-y-auto px-4 space-y-6'>
						<section className='space-y-3'>
							<h3 className='font-semibold'>Global Defaults</h3>
							<div className='space-y-2'>
								{notificationKeys.map((key) => (
									<div
										key={`global-${key}`}
										className='flex items-center justify-between gap-4 border rounded-md p-3'
									>
										<p className='text-sm'>
											{notificationLabels[key]}
										</p>
										<Button
											size='sm'
											variant={
												preferences.global[key]
													? "default"
													: "outline"
											}
											onClick={() =>
												handleGlobalToggle(key)
											}
											disabled={isBusy}
										>
											{preferences.global[key]
												? "On"
												: "Off"}
										</Button>
									</div>
								))}
								<div className='flex items-center justify-between gap-4 border rounded-md p-3 opacity-80'>
									<p className='text-sm'>Theme</p>
									<Button
										size='sm'
										variant='secondary'
										disabled
									>
										Dark only
									</Button>
								</div>
							</div>
						</section>

						<section className='space-y-3'>
							<h3 className='font-semibold'>This Room</h3>
							<div className='space-y-2'>
								{notificationKeys.map((key) => (
									<div
										key={`room-${key}`}
										className='flex items-center justify-between gap-4 border rounded-md p-3'
									>
										<div className='flex flex-col'>
											<p className='text-sm'>
												{notificationLabels[key]}
											</p>
											<p className='text-xs text-muted-foreground'>
												Effective:{" "}
												{preferences.effective[key]
													? "On"
													: "Off"}
											</p>
										</div>
										<Button
											size='sm'
											variant={overrideVariant(
												preferences.room_overrides[key],
											)}
											onClick={() => handleRoomCycle(key)}
											disabled={isBusy}
										>
											{overrideLabel(
												preferences.room_overrides[key],
											)}
										</Button>
									</div>
								))}
							</div>
						</section>
					</div>
				)}

				<DialogFooter className='gap-2'>
					<Button
						variant='secondary'
						onClick={() => void handleSendTestPush()}
						disabled={isBusy || isSendingTestPush}
					>
						{isSendingTestPush ? "Sending..." : "Send test push"}
					</Button>
					<Button
						variant='outline'
						onClick={handleResetRoom}
						disabled={isBusy || !preferences}
					>
						Reset room overrides
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
