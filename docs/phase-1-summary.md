# Phase 1 Architecture Refactor Summary

## Files moved

### Application bootstrap (`app/`)
- `apps/web/src/App.tsx` → `apps/web/src/app/App.tsx`
- `apps/web/src/pages/room/RoomLayout.tsx` → `apps/web/src/app/layouts/RoomLayout.tsx`
- `apps/web/src/pages/NotFoundPage.tsx` → `apps/web/src/app/router/NotFoundPage.tsx`
- Created: `apps/web/src/app/router/index.tsx`
- Created: `apps/web/src/app/providers/AppProviders.tsx`

### Entities (`entities/`)
- `apps/web/src/store/player.ts` → `apps/web/src/entities/player/hooks/player.ts`
- `apps/web/src/store/preferences.ts` → `apps/web/src/entities/player/hooks/preferences.ts`
- `apps/web/src/hooks/useWeeklyClaim.ts` → `apps/web/src/entities/player/hooks/useWeeklyClaim.ts`
- `apps/web/src/types/Player.ts` → `apps/web/src/entities/player/model/types.ts`

- `apps/web/src/store/room.ts` → `apps/web/src/entities/room/hooks/room.ts`
- `apps/web/src/hooks/useRoomRealtime.ts` → `apps/web/src/entities/room/hooks/useRoomRealtime.ts`
- `apps/web/src/types/Room.ts` → `apps/web/src/entities/room/model/types.ts`

- `apps/web/src/store/prediction.ts` → `apps/web/src/entities/prediction/hooks/prediction.ts`
- `apps/web/src/store/bet.ts` → `apps/web/src/entities/prediction/hooks/bet.ts`
- `apps/web/src/types/Prediction.ts` → `apps/web/src/entities/prediction/model/types.ts`
- `apps/web/src/types/Bet.ts` → `apps/web/src/entities/prediction/model/bet.ts`

- `apps/web/src/store/duel.ts` → `apps/web/src/entities/duel/hooks/duel.ts`
- `apps/web/src/types/Duel.ts` → `apps/web/src/entities/duel/model/types.ts`

- `apps/web/src/store/leaderboard.ts` → `apps/web/src/entities/leaderboard/hooks/leaderboard.ts`
- `apps/web/src/types/Leaderboard.ts` → `apps/web/src/entities/leaderboard/model/types.ts`
- `apps/web/src/types/Stats.ts` → `apps/web/src/entities/leaderboard/model/stats.ts`

### Features (`features/`)
- `apps/web/src/pages/auth/*` → `apps/web/src/features/auth/pages/*`
- `apps/web/src/components/ProtectedRoute.tsx` → `apps/web/src/features/auth/components/ProtectedRoute.tsx`
- `apps/web/src/contexts/AuthContext.tsx` → `apps/web/src/features/auth/context/AuthContext.tsx`

- `apps/web/src/pages/home/*` → `apps/web/src/features/dashboard/home/*`
- `apps/web/src/pages/LeaderboardPage.tsx` → `apps/web/src/features/dashboard/pages/LeaderboardPage.tsx`
- `apps/web/src/pages/room/RoomDashboard.tsx` → `apps/web/src/features/dashboard/pages/RoomDashboard.tsx`

- `apps/web/src/pages/room/predictions/New.tsx` → `apps/web/src/features/create-prediction/pages/New.tsx`
- `apps/web/src/pages/room/duels/PredictionDuelCreatePage.tsx` → `apps/web/src/features/create-duel/pages/PredictionDuelCreatePage.tsx`

- `apps/web/src/pages/room/duels/PredictionDuelsPage.tsx` → `apps/web/src/features/duel-details/pages/PredictionDuelsPage.tsx`
- `apps/web/src/pages/room/duels/PredictionDuelDetailPage.tsx` → `apps/web/src/features/duel-details/pages/PredictionDuelDetailPage.tsx`
- `apps/web/src/pages/room/duels/components/*` → `apps/web/src/features/duel-details/components/*`

- `apps/web/src/pages/room/PredictionPage.tsx` → `apps/web/src/features/prediction-details/pages/PredictionPage.tsx`
- `apps/web/src/pages/room/components/*` → `apps/web/src/features/prediction-details/components/*`
- `apps/web/src/pages/room/controls/*` → `apps/web/src/features/prediction-details/controls/*`
- `apps/web/src/pages/room/predictions/*` (except New) → `apps/web/src/features/prediction-details/predictions/*`
- `apps/web/src/pages/room/widgets/*` → `apps/web/src/features/prediction-details/widgets/*`
- `apps/web/src/pages/room/player/*` → `apps/web/src/features/prediction-details/player/*`
- `apps/web/src/pages/room/leaderboard/*` → `apps/web/src/features/prediction-details/leaderboard/*`

- `apps/web/src/pages/room/components/RoomPreferencesDialog.tsx` → `apps/web/src/features/preferences/components/RoomPreferencesDialog.tsx`

- `apps/web/src/components/HowToPlayModal.tsx` → `apps/web/src/features/onboarding/components/HowToPlayModal.tsx`
- `apps/web/src/components/StepperTipsDialog.tsx` → `apps/web/src/features/onboarding/components/StepperTipsDialog.tsx`
- `apps/web/src/components/DuelsHowItWorksDialog.tsx` → `apps/web/src/features/onboarding/components/DuelsHowItWorksDialog.tsx`
- `apps/web/src/components/LeaderboardTipsDialog.tsx` → `apps/web/src/features/onboarding/components/LeaderboardTipsDialog.tsx`

### Shared (`shared/`)
- `apps/web/src/components/ui/*` → `apps/web/src/shared/ui/*`
- `apps/web/src/components/animations/*` → `apps/web/src/shared/ui/animations/*`
- `apps/web/src/hooks/useLocalStorage.ts` → `apps/web/src/shared/hooks/useLocalStorage.ts`
- `apps/web/src/hooks/useOptionColor.ts` → `apps/web/src/shared/hooks/useOptionColor.ts`
- `apps/web/src/hooks/useNotificationPermission.ts` → `apps/web/src/shared/hooks/useNotificationPermission.ts`
- `apps/web/src/lib/*` → `apps/web/src/shared/lib/*`
- `apps/web/src/store/_keys.ts` → `apps/web/src/shared/constants/queryKeys.ts`
- `apps/web/src/types/supabase.ts` → `apps/web/src/shared/lib/supabase.types.ts`
- `apps/web/src/assests/styles/global.css` → `apps/web/src/shared/assets/styles/global.css`

## Folders created
- `apps/web/src/app/providers`
- `apps/web/src/app/router`
- `apps/web/src/app/layouts`
- `apps/web/src/entities/*/{hooks,model}`
- `apps/web/src/features/auth`
- `apps/web/src/features/dashboard`
- `apps/web/src/features/create-prediction`
- `apps/web/src/features/prediction-details`
- `apps/web/src/features/create-duel`
- `apps/web/src/features/duel-details`
- `apps/web/src/features/preferences`
- `apps/web/src/features/onboarding`
- `apps/web/src/shared/ui`
- `apps/web/src/shared/hooks`
- `apps/web/src/shared/lib`
- `apps/web/src/shared/constants`
- `apps/web/src/shared/assets`

## Architectural decisions made
- Introduced `app/router/index.tsx` so route configuration is isolated from provider/bootstrap concerns.
- Introduced `app/providers/AppProviders.tsx` to centralize `QueryClientProvider`, `AuthProvider`, and `Toaster` setup.
- Replaced `store/*` with entity-owned hook modules under `entities/*/hooks` without changing hook logic.
- Moved domain types from `types/*` into their owning entity model folders and exported through entity barrels.
- Kept API wrapper implementations in `shared/lib/api.ts` for this phase and updated imports to align with new folder boundaries.
- Preserved route tree behavior and route handles exactly while relocating page/component modules.

## Dependency rule violations not fully resolved
- Feature-to-feature imports still exist where dashboard/orchestration UI composes prediction-detail and onboarding modules.
- Preferences dialog is feature-owned and consumed from prediction-details.
- Shared `api.ts` remains cross-domain and is still used by multiple entities, so API ownership is partially centralized.

## Recommendations for Phase 2
- Eliminate remaining feature-to-feature imports by extracting truly reusable presentation modules into `shared/ui` and moving domain orchestration into entity-level adapters.
- Split `shared/lib/api.ts` into entity-owned API modules (`entities/*/api`) and convert existing imports to those ownership boundaries.
- Introduce stricter path import constraints (eslint/tsconfig layer rules) to enforce dependency direction.
- Add dedicated `app/providers/query-client.ts` and typed `queryKeys` ownership per entity to further reduce shared coupling.
- Add route entry barrels per feature (`features/*/index.ts`) and tighten import normalization to those barrels only.
