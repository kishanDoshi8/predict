# Phase 2.5 Architecture Summary (`apps/web`)

## 1. Feature folders consolidated

The feature layer was consolidated around business domains:

- `features/auth`
- `features/home`
- `features/rooms`
- `features/predictions`
- `features/duels`
- `features/leaderboard`
- `features/preferences`
- `features/onboarding`

Legacy route/action-oriented folders were folded into domain owners:

- `features/create-prediction` + `features/prediction-details` → `features/predictions`
- `features/create-duel` + `features/duel-details` → `features/duels`
- `features/dashboard/home` → `features/home`
- `features/dashboard/pages/RoomDashboard` → `features/rooms`
- `features/dashboard/pages/LeaderboardPage` → `features/leaderboard`

## 2. Entity folders removed

The `apps/web/src/entities` layer was removed entirely.

Entity-owned code was moved into owning features:

- prediction types/hooks → `features/predictions/{types,hooks}`
- duel types/hooks → `features/duels/{types,hooks}`
- room types/hooks/realtime hooks → `features/rooms/{types,hooks}`
- leaderboard types/stats/hooks → `features/leaderboard/{types,hooks}`
- player types/hooks → `features/home/{types,hooks}`
- preference hooks → `features/preferences/hooks`

## 3. Public APIs created

Feature public APIs are now exposed via `index.ts` files:

- `features/auth/index.ts`
- `features/home/index.ts`
- `features/rooms/index.ts`
- `features/predictions/index.ts`
- `features/duels/index.ts`
- `features/leaderboard/index.ts`
- `features/preferences/index.ts`
- `features/onboarding/index.ts`

Cross-feature and app-level imports were updated to consume these public APIs.

## 4. Cross-feature dependencies identified

Current intentional domain dependencies include:

- `rooms` depends on `predictions` for room dashboard rendering.
- `predictions` depends on `leaderboard` for history/profile/podium UI and leaderboard types.
- `predictions` depends on `duels` for duel summary cards.
- `duels` depends on `predictions` for prediction/bet data and `rooms` for realtime hooks.
- `leaderboard` depends on `home` for current player identity.
- `app` imports route entry components and providers from feature public APIs.

## 5. New ownership rules

Adopted ownership rules in this refactor:

- Domain/business code belongs to one owning feature.
- Shared code remains framework-agnostic and app-wide only.
- App layer remains bootstrap-only (router/layout/providers).
- Cross-feature imports should go through `@/features/<domain>` public APIs.
- Business types/hooks/components do not live in `shared`.

## 6. Folder structure after consolidation

```text
apps/web/src/
  app/
  features/
    auth/
    home/
    rooms/
    predictions/
    duels/
    leaderboard/
    preferences/
    onboarding/
  shared/
```

Each domain feature now contains its own hooks/types/components/pages as needed.

## 7. Remaining architectural recommendations before Phase 3

- Keep expanding feature public APIs so app/router never imports feature internals.
- Continue replacing any same-feature barrel self-imports with local paths to avoid internal cycles.
- Consider aligning route component folder naming (`pages` vs `routes`) consistently per feature.
- Introduce lightweight architecture lint rules (if desired) to guard against deep cross-feature imports.
