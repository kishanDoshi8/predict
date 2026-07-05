# Phase 3 Summary (apps/web)

## 1) Initial bundle analysis

- Baseline build produced a single large JS entry chunk (`index-BF535n3g.js`): **1,077.90 kB** (gzip **315.26 kB**).
- Most routes were eagerly imported from `/src/app/router/index.tsx`, so authentication, duels, leaderboard, prediction creation/detail flows, and other room pages were pulled into initial load.
- Heavy feature modules found in main route graph:
  - `features/predictions/pages/New.tsx` (large create flow)
  - `features/predictions/components/stats/UserStats.tsx`
  - `features/leaderboard/components/player/PlayerProfileDialog.tsx`
  - `features/preferences/components/RoomPreferencesDialog.tsx`
  - onboarding dialogs/modals
- Duplicate/overlapping dependency usage found:
  - `framer-motion` + `motion` both present for animation usage.
- Confirmed unused dependencies:
  - `@tanstack/react-query-devtools`
  - `vite-plugin-pwa`
  - `zustand`

## 2) Bundle size before optimization

- JS: `dist/assets/index-BF535n3g.js` = **1,077.90 kB** (gzip **315.26 kB**)
- CSS: `dist/assets/index-CJhJ0V60.css` = **120.64 kB** (gzip **18.18 kB**)

## 3) Bundle size after optimization

- Main JS: `dist/assets/index-BG21cDuL.js` = **655.54 kB** (gzip **196.15 kB**)
- CSS: `dist/assets/index-Buf328Fi.css` = **120.67 kB** (gzip **18.19 kB**)
- Additional route/feature chunks now emitted (examples):
  - `LeaderboardPage-Bsiz1ZaO.js` = 8.67 kB
  - `PredictionPage-D1YR5DUt.js` = 44.25 kB
  - `PredictionDuelDetailPage-D04hPNDr.js` = 15.44 kB
  - `New-DzNQwTNX.js` = 108.80 kB
  - auth chunks (`LoginPage`, `SignupPage`, `ForgotPasswordPage`, `ResetPasswordPage`)

## 4) Chunk structure before

- Single dominant app chunk for most app code (`index-*.js`).
- Route modules and on-demand dialogs were mostly bundled eagerly.

## 5) Chunk structure after

- Route-level split chunks for auth, leaderboard, prediction flows, duel flows, and create-player flow.
- Feature-level split chunks for:
  - `HowToPlayModal`
  - `LeaderboardTipsDialog`
  - `PlayerProfileDialog`
- Fallback/error route utilities split as small shared chunks.

## 6) Routes converted to lazy loading

- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/create-player`
- `/rooms/:roomCode` children:
  - index dashboard
  - `predictions/new`
  - `predictions/:predictionId`
  - `predictions/:predictionId/duels`
  - `predictions/:predictionId/duels/create`
  - `predictions/:predictionId/duels/:duelId`
  - `leaderboard`
- `/404`

## 7) Components converted to lazy loading

- `HowToPlayModal` (Home + Room layout; loaded only when opened)
- `LeaderboardTipsDialog` (leaderboard page; loaded only when opened)
- `PlayerProfileDialog` (leaderboard + user stats; loaded only when opened)

## 8) Manual chunk decisions and justification

- **No manualChunks added.**
- After route/component lazy loading, Vite automatic chunking produced meaningful boundaries by route/feature module.
- Manual chunking was deferred to avoid brittle chunk rules and micro-chunking overhead without stronger evidence.

## 9) Dependencies removed

- Removed `motion` (duplicate animation path; switched `motion/react` imports to `framer-motion`).
- Removed `@tanstack/react-query-devtools` (unused in source).
- Removed `vite-plugin-pwa` (plugin not used in Vite config).
- Removed `zustand` (unused in source).

## 10) Sonar improvements

- Reduced eager import graph in router via explicit lazy route boundaries.
- Removed unused exports coupling:
  - stopped re-exporting `LeaderboardPage`/`SortByOption` from feature index.
  - moved `SortByOption` into leaderboard types to avoid page coupling.
- Removed dead file:
  - `src/shared/lib/queryClientConfig.ts` (unused).

## 11) Performance improvements

- Added route-level `React.lazy` + `Suspense` to reduce startup payload and defer non-shell route code.
  - Benefit: **startup time + bundle size at initial load**
- Added feature-level lazy loading for modal/dialog paths opened on demand.
  - Benefit: **startup time + route runtime responsiveness**
- Added route error boundary (`RouteErrorBoundary`) and loading fallback (`RouteFallback`).
  - Benefit: **resilience/maintainability**, graceful failure for route-loading errors.

## 12) Remaining recommendations

- Main chunk is still above 500 kB; next candidate is splitting large shared dependencies (e.g., charting and heavier UI paths) if profiling confirms benefit.
- Consider evaluating route-level data-loading boundaries to further isolate heavy prediction create/detail modules.
- Lint command currently fails due ESLint v9 flat-config mismatch (`eslint.config.*` missing); align lint config to restore CI lint signal.

## Optimization rationale (what and why)

- **Router lazy loading**: chosen because baseline showed route code loaded eagerly; improves startup payload and loads code on navigation.
- **On-demand dialog lazy loading**: chosen because dialogs are user-triggered and not required for initial render; reduces unnecessary parse/execute work.
- **Dependency cleanup**: chosen for measurable install/build/runtime graph reduction and reduced maintenance overhead.
- **Error boundary + fallback**: chosen for production readiness; failures now degrade gracefully instead of blank/broken route rendering.
