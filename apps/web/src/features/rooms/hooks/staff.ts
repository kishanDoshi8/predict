import {
	getRoomManageQueue,
	setMemberRole,
	transferOwnership,
	updateRoom,
	type RoomSettings,
} from "@/shared/lib/api";
import { roomKeys } from "@/shared/constants/queryKeys";
import type { RoomRole } from "@/features/rooms/lib/roles";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

// Staff only: what's waiting to be closed, and what's still open for picks.
export const useManageQueue = (roomId: string, enabled = true) => {
	return useQuery({
		queryKey: roomKeys.manageQueue(roomId),
		queryFn: () => getRoomManageQueue(roomId),
		enabled: !!roomId && enabled,
	});
};

// Members, roles and room details all come from the by-code room query.
const refreshRoom = (queryClient: QueryClient, roomId: string) => {
	queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId) });
	queryClient.invalidateQueries({
		predicate: (query) =>
			query.queryKey[0] === roomKeys.all[0] &&
			(query.queryKey[1] === "code" || query.queryKey[1] === "player"),
	});
};

export const useSetMemberRole = (roomId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ playerId, role }: { playerId: string; role: Exclude<RoomRole, "owner"> }) =>
			setMemberRole(roomId, playerId, role),
		onSuccess: () => refreshRoom(queryClient, roomId),
	});
};

export const useTransferOwnership = (roomId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (playerId: string) => transferOwnership(roomId, playerId),
		onSuccess: () => refreshRoom(queryClient, roomId),
	});
};

export const useUpdateRoom = (roomId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (settings: RoomSettings) => updateRoom(roomId, settings),
		onSuccess: () => refreshRoom(queryClient, roomId),
	});
};
