import { RoomActivity } from "@/features/activities/types/types";

export type ActivityCardComponentProps<TActivity extends RoomActivity> = {
	activity: TActivity;
	roomCode: string;
};
