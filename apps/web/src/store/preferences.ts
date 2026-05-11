import {
  getPreferences,
  PreferenceResponse,
  PreferenceSettings,
  resetRoomPreferences,
  RoomPreferenceOverrides,
  updateGlobalPreferences,
  updateRoomPreferences,
} from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roomKeys } from "./_keys";

const mergeEffective = (
  global: PreferenceSettings,
  roomOverrides: RoomPreferenceOverrides,
): PreferenceSettings => ({
  prediction_live: roomOverrides.prediction_live ?? global.prediction_live,
  prediction_locked: roomOverrides.prediction_locked ?? global.prediction_locked,
  deadline_1h: roomOverrides.deadline_1h ?? global.deadline_1h,
  result_revealed: roomOverrides.result_revealed ?? global.result_revealed,
  weekly_points_claim:
    roomOverrides.weekly_points_claim ?? global.weekly_points_claim,
  dark_mode: roomOverrides.dark_mode ?? global.dark_mode,
  sounds_enabled: roomOverrides.sounds_enabled ?? global.sounds_enabled,
});

export const usePreferences = (roomId: string) => {
  return useQuery({
    queryKey: roomKeys.preferences(roomId),
    queryFn: () => getPreferences(roomId),
    enabled: !!roomId,
  });
};

export const useUpdateGlobalPreferences = (roomId: string) => {
  const queryClient = useQueryClient();
  const queryKey = roomKeys.preferences(roomId);

  return useMutation({
    mutationFn: (preferences: PreferenceSettings) =>
      updateGlobalPreferences(preferences),
    onMutate: async (preferences) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<PreferenceResponse>(queryKey);
      if (previous) {
        queryClient.setQueryData<PreferenceResponse>(queryKey, {
          ...previous,
          global: preferences,
          effective: mergeEffective(preferences, previous.room_overrides),
        });
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
};

export const useUpdateRoomPreferences = (roomId: string) => {
  const queryClient = useQueryClient();
  const queryKey = roomKeys.preferences(roomId);

  return useMutation({
    mutationFn: (preferences: RoomPreferenceOverrides) =>
      updateRoomPreferences(roomId, preferences),
    onMutate: async (preferences) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<PreferenceResponse>(queryKey);
      if (previous) {
        queryClient.setQueryData<PreferenceResponse>(queryKey, {
          ...previous,
          room_overrides: preferences,
          effective: mergeEffective(previous.global, preferences),
        });
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
};

export const useResetRoomPreferences = (roomId: string) => {
  const queryClient = useQueryClient();
  const queryKey = roomKeys.preferences(roomId);

  return useMutation({
    mutationFn: () => resetRoomPreferences(roomId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<PreferenceResponse>(queryKey);
      if (previous) {
        const resetOverrides: RoomPreferenceOverrides = {
          prediction_live: null,
          prediction_locked: null,
          deadline_1h: null,
          result_revealed: null,
          weekly_points_claim: null,
          dark_mode: null,
          sounds_enabled: null,
        };

        queryClient.setQueryData<PreferenceResponse>(queryKey, {
          ...previous,
          room_overrides: resetOverrides,
          effective: mergeEffective(previous.global, resetOverrides),
        });
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
};
