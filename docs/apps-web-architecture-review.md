# apps/web Architecture Review

## Scope
This review covers the React application under `apps/web` only.
No source code changes were made.

---

## 1. Project Overview

### Current folder structure
- `src/App.tsx`, `src/main.tsx`: app bootstrap + routing
- `src/pages/**`: route-level and page-level UI
  - `pages/home/**`
  - `pages/room/**` (largest area)
  - `pages/auth/**`
- `src/store/**`: TanStack Query hooks (queries/mutations)
- `src/lib/**`: API wrappers, Supabase client, utilities
- `src/hooks/**`: custom UI/realtime hooks
- `src/components/**`: shared UI and app components
  - `components/ui/**`: primitive/design-system-like building blocks
- `src/types/**`: app models and generated Supabase types
- `src/contexts/AuthContext.tsx`: auth context

### Major architectural patterns
- Route-driven page composition with nested routes (`App.tsx` + `RoomLayout.tsx`)
- Server state via TanStack Query hooks in `src/store/*`
- API access centralized in `src/lib/api.ts` (single large gateway)
- Feature logic largely page-centric (especially under `pages/room/**`)
- Shared component barrel (`src/components/index.ts`) used inconsistently with direct UI imports

### Routing organization
- Centralized route table in `src/App.tsx`
- Protected route wrapper for authenticated area (`ProtectedRoute.tsx`)
- Nested room routes under `/rooms/:roomCode` with shared layout and route `handle` metadata
- Good hierarchical route intent, but route definitions and imports in one large file

### State management
- Primary state: TanStack Query (`src/store/**`)
- Local UI state: component-level `useState` and `useEffect`
- Context state: auth only (`AuthContext`)
- Persistence: localStorage (`useLocalStorage`, direct localStorage usage in some components)
- `zustand` dependency is present but not used in app code

### TanStack Query usage
- Query key factory exists (`src/store/_keys.ts`) and is used broadly
- Query/mutation hooks are grouped by domain (`player`, `room`, `prediction`, `bet`, `duel`, `preferences`, `leaderboard`)
- Optimistic updates implemented in key places (`bet.ts`, `preferences.ts`)
- Invalidation strategy works but is repetitive and sometimes inconsistent
- Notable inconsistency: `usePredictionHistory` uses a raw key (`['prediction-history', ...]`) instead of key factory

### Provider hierarchy
- `main.tsx` → `<App />`
- `App.tsx` provider stack:
  1. `QueryClientProvider`
  2. `AuthProvider`
  3. `RouterProvider`
  4. `Toaster`

### Shared utilities
- `lib/utils.ts`: `cn`, `twColor`
- `hooks/useLocalStorage.ts`
- `hooks/useNotificationPermission.ts`
- `hooks/useRoomRealtime.ts`
- `components/StepperTipsDialog.tsx` as reusable guided-dialog shell

### UI organization
- `components/ui/**`: solid primitive base
- `components/index.ts`: central export barrel
- Reusable primitives are good, but feature-level composites are duplicated in multiple page folders

### Type organization
- Domain types in `src/types/*`
- Generated schema type in `src/types/supabase.ts`
- API response typing is mixed (inline casts + shared types + `any`/untyped areas)

---

## 2. Strengths

1. **Clear route hierarchy** with nested room layout and per-route header metadata (`App.tsx`, `RoomLayout.tsx`).
2. **Strong server-state foundation** using TanStack Query with domain-specific hooks in `src/store/*`.
3. **Centralized backend access** in `src/lib/api.ts` avoids Supabase calls scattered across many components.
4. **Good UX focus** with loading, skeletons, optimistic updates, and realtime invalidation hooks.
5. **Reusable primitive UI layer** (`components/ui/**`) is broad and supports consistent composition.
6. **Strict TS config** (`strict`, `noUnusedLocals`, `noUnusedParameters`) is enabled.
7. **Feature-rich room domain modeling** (duels, predictions, leaderboard, preferences) is already separated by responsibility at a high level.

---

## 3. Weaknesses

### Oversized components/hooks/files
- `src/lib/api.ts` (~650 lines): oversized utility gateway with many concerns.
- `src/pages/room/duels/PredictionDuelDetailPage.tsx` (~1100 lines): major cognitive hotspot.
- `src/pages/room/components/stats/UserStats.tsx` (~500 lines).
- `src/pages/room/components/InPlayPredictions.tsx` (~480 lines).
- `src/pages/room/controls/DraftControls.tsx` (~400 lines).
- `src/pages/room/predictions/New.tsx` (~400 lines).

### Duplicated UI and business logic
- Leaderboard summary logic duplicated between:
  - `pages/LeaderboardPage.tsx`
  - `pages/room/components/stats/UserStats.tsx`
- Bet list rendering patterns duplicated across:
  - `LockedPhase.tsx`
  - `ResolvedPhase.tsx`
  - `NoResult.tsx`
- Dialog/stepper modal patterns repeated with similar behavior.
- Auth forms repeat layout and validation structure across 4 files.

### Duplicated query/mutation patterns
- Duel mutations repeat near-identical invalidation blocks (`store/duel.ts`).
- Shared post-mutation refresh strategy is not centralized.

### Inconsistent naming and organization
- `assests` folder typo (`src/assests/styles/global.css`).
- Mixed import style (`@/components` barrel vs `@/components/ui/...` direct).
- Mixed naming conventions (`PredictionNew` in `New.tsx`, `PredictionPage`, `RoomDashboard`).

### Separation-of-concerns issues
- Some UI components perform navigation side effects during render (`RoomLayout.tsx`, `OrganizerControls.tsx`).
- `PredictionDuelCreatePage.tsx` imports `StakeBreakdown` from detail page file (cross-page coupling).
- `useOptionColor` uses module mutable state and is named as a hook though it is not hook-like behavior.

### Repeated loading/empty/error handling
- Loading/empty cards and skeletons are repeated in multiple feature files without shared abstraction.
- Toast error handling is implemented ad hoc in many components.

### Technical implementation inconsistency
- `lib/queryClientConfig.ts` defines a configured QueryClient but `App.tsx` instantiates a separate default QueryClient.

---

## 4. Feature Folder Opportunities

### Recommended direction
Adopt a **feature-first + shared-kernel** structure:
- `app` for providers/router/bootstrap
- `features/*` for domain verticals
- `shared/*` for reusable UI/util/type helpers

### Suggested target structure

```text
apps/web/src
  app/
    providers/
    router/
    App.tsx
    main.tsx
  features/
    auth/
      pages/
      hooks/
      api/
      model/
    home/
      pages/
      components/
      hooks/
    rooms/
      layout/
      dashboard/
      members/
    predictions/
      pages/
      components/
      hooks/
      model/
    duels/
      pages/
      components/
      hooks/
      model/
    leaderboard/
      pages/
      components/
      hooks/
      model/
    preferences/
      components/
      hooks/
      model/
  shared/
    ui/
    hooks/
    lib/
    types/
    realtime/
```

### Where existing files would belong

| Current location | Target location |
|---|---|
| `App.tsx`, `main.tsx` | `app/router`, `app/providers` |
| `contexts/AuthContext.tsx` | `features/auth/model` or `features/auth/providers` |
| `store/player.ts` | `features/auth/hooks` or `features/player/hooks` |
| `store/room.ts` | `features/rooms/hooks` |
| `store/prediction.ts` | `features/predictions/hooks` |
| `store/bet.ts` | `features/predictions/hooks` |
| `store/duel.ts` | `features/duels/hooks` |
| `store/leaderboard.ts` | `features/leaderboard/hooks` |
| `store/preferences.ts` | `features/preferences/hooks` |
| `store/_keys.ts` | `shared/lib/queryKeys` (or feature-local key modules + shared base) |
| `lib/api.ts` | split into `features/*/api/*` + thin shared client layer |
| `lib/supabase.ts` | `shared/lib/supabaseClient` |
| `lib/utils.ts` | `shared/lib/utils` |
| `hooks/useRoomRealtime.ts` | `shared/realtime` + feature adapters |
| `hooks/useLocalStorage.ts` | `shared/hooks` |
| `hooks/useNotificationPermission.ts` | `shared/hooks` or `features/preferences/hooks` |
| `pages/auth/*` | `features/auth/pages` |
| `pages/home/*` | `features/home/*` |
| `pages/room/components/*` | split across `features/rooms`, `features/predictions`, `features/preferences`, `features/leaderboard` |
| `pages/room/controls/*` | `features/predictions/components/controls` |
| `pages/room/predictions/*` | `features/predictions/*` |
| `pages/room/duels/*` | `features/duels/*` |
| `pages/room/leaderboard/*` + `pages/LeaderboardPage.tsx` | `features/leaderboard/*` |
| `components/ui/*` | `shared/ui` |
| `components/*Dialog*`, `HowToPlayModal` | `shared/ui/dialogs` or feature-level dialog folders |
| `types/*` | `shared/types` + feature-scoped model types |

Why this helps: lower coupling, clearer ownership, smaller files, easier incremental refactors and testing.

---

## 5. Shared Component Opportunities

| Candidate extraction | Current duplication points | Estimated duplication reduction |
|---|---|---|
| **BetOutcomeList** (rows for who bet what / payout rows) | `LockedPhase`, `ResolvedPhase`, `NoResult` | 30–45% in those files |
| **LeaderboardSummaryPanel** | `LeaderboardPage`, `UserStats` | 35–50% |
| **LeaderboardFilters** (tab + sort controls) | `LeaderboardPage`, `UserStats` | 25–35% |
| **StickyBottomActionBar** | duel pages + organizer/create flows | 20–30% |
| **StateCard (loading/empty/error shells)** | many page sections | 15–25% across dashboard screens |
| **AuthFormShell** | login/signup/forgot/reset pages | 30–40% |
| **RoomCodeDisplay + CopyButton** | room header and possible share surfaces | 10–15% |
| **Step-based tips dialog** already exists; expand usage consistently | `HowToPlayModal`, tips dialogs | 20–30% of dialog-specific boilerplate |

---

## 6. Hooks

### Split
- `useRoomRealtime.ts` should be split by domain trigger sets:
  - room members/stats
  - prediction updates
  - duel updates
- `useOptionColor.ts` should be split/reworked to avoid global mutable map semantics.

### Merge/Consolidate
- Combine repeated leaderboard tab/sort localStorage behavior into one shared hook used by both leaderboard surfaces.

### Move
- Feature-specific hooks currently in `src/hooks` should move into feature folders (e.g., weekly claim into player/auth or rewards feature).

---

## 7. TanStack Query

### Current assessment
- Good baseline usage and optimistic handling in critical flows.
- Query key strategy is mostly strong but not fully standardized.

### Recommendations
1. **Standardize query keys**
   - Move all keys to one strategy (either central factory or per-feature factory).
   - Replace raw `['prediction-history', ...]` with factory key.
2. **Centralize invalidation maps**
   - Duel and prediction mutations repeatedly invalidate same sets; create per-mutation invalidation helpers.
3. **Adopt configured QueryClient consistently**
   - Use `lib/queryClientConfig.ts` in app bootstrap.
4. **Encapsulate mutation side effects**
   - Wrap common toast + invalidate + rollback behavior in reusable helper utilities.
5. **Refine optimistic updates**
   - Keep current optimistic approach in bets/preferences and extend carefully where high-confidence domain invariants exist.
6. **Add reusable query hook facades**
   - Expose page-facing hooks from feature modules rather than directly composing multiple low-level hooks in page components.

---

## 8. React Best Practices

### Composition
- Strength: many composed UI primitives.
- Issue: too much business logic in top-level page components; needs presenter/container split in large files.

### Memoization and render control
- Large components compute derived values inline repeatedly; selective `useMemo` extraction in hotspots would reduce rerenders.

### Lazy loading and suspense
- No route-level lazy loading observed in router config.
- Consider lazy boundaries for heavyweight routes (duel detail, stats-heavy screens).

### Context usage
- Auth context is focused and appropriate.
- Avoid adding broad contexts for domain state already managed by TanStack Query.

### Provider organization
- Provider stack is simple; keep this.
- QueryClient creation should be centralized to preserve global query defaults.

### File naming and import organization
- Inconsistency in naming and import style should be normalized by lint rules and module boundaries.

---

## 9. TypeScript

### Strengths
- Strict compiler settings.
- Domain models exist for key entities.

### Gaps
- `lib/api.ts` uses significant inline casting and `any`/untyped client bridges.
- Duplicate shape definitions likely between API return casts and domain type files.
- Some files import through barrel while others import direct type modules inconsistently.

### Recommendations
- Introduce feature-level DTO types (`api/types.ts`) and map DTO -> domain model explicitly.
- Minimize `as` casting in API layer by narrowing Supabase response types where possible.
- Keep generated Supabase types isolated and wrap them with domain-facing models.

---

## 10. Technical Debt (Prioritized)

### High impact
1. **Massive page complexity** (`PredictionDuelDetailPage.tsx`, `UserStats.tsx`, `InPlayPredictions.tsx`).
2. **Monolithic API gateway** (`lib/api.ts`).
3. **Duplicated leaderboard and bet-rendering logic**.
4. **Inconsistent query client setup** (`queryClientConfig.ts` unused by App).

### Medium impact
5. **Unused/dead or low-value artifacts**:
   - `pages/home/controls/PlayerNew.tsx` appears unreferenced.
   - `components/ui/sonner.tsx` exported but not used by App.
6. **Placeholder component** `PodiumStatCard.tsx` returns `null`.
7. **Cross-page import coupling** (`PredictionDuelCreatePage` -> `StakeBreakdown` from detail page).

### Low impact
8. **Naming/typo debt** (`assests`).
9. **Mixed import conventions** (barrel vs direct).

### Circular imports
- No obvious circular imports found from static scan; recommend automated check in CI to confirm.

### Unnecessary dependencies (likely)
- `zustand` not referenced in `src`.
- `@tanstack/react-query-devtools` not referenced in `src`.
- `next-themes` appears only in `components/ui/sonner.tsx`, which itself appears unused.

---

## 11. Sonar Issue Hotspots

| File | Likely issue type | Fix difficulty |
|---|---|---|
| `pages/room/duels/PredictionDuelDetailPage.tsx` | high cognitive complexity, long methods, deep branching | High |
| `lib/api.ts` | long file, mixed responsibilities, repeated patterns | High |
| `pages/room/components/stats/UserStats.tsx` | long component, duplicated leaderboard logic | Medium |
| `pages/room/components/InPlayPredictions.tsx` | nested UI + data logic + storage behavior | Medium |
| `pages/room/controls/DraftControls.tsx` | nested conditionals, state orchestration complexity | Medium |
| `pages/room/predictions/New.tsx` | long function, validation + deadline logic mixed with UI | Medium |
| `store/duel.ts` | repeated mutation invalidation blocks (duplication) | Low-Medium |
| `pages/auth/*.tsx` | repetitive forms (duplication) | Low |

---

## 12. Migration Strategy (Phased)

### Phase 1 — Establish boundaries
- **Objective:** Introduce feature folders and shared module boundaries without behavior changes.
- **Risk:** Low
- **Effort:** Medium
- **Benefits:** Clear ownership and lower coupling for future refactors.
- **Likely files affected:** app bootstrap/routing and folder-level reorganizations for hooks/components/types exports.

### Phase 2 — Query key and mutation standardization
- **Objective:** Normalize query keys and centralize invalidation utilities.
- **Risk:** Medium
- **Effort:** Medium
- **Benefits:** Fewer cache bugs, consistent query behavior.
- **Likely files affected:** `store/_keys.ts`, `store/*.ts` hooks, `App.tsx` query client wiring.

### Phase 3 — API layer decomposition
- **Objective:** Split `lib/api.ts` into feature-specific API modules.
- **Risk:** Medium
- **Effort:** High
- **Benefits:** Better maintainability, type safety, easier testing.
- **Likely files affected:** `lib/api.ts`, `store/*.ts`, feature pages consuming hooks.

### Phase 4 — Large component decomposition
- **Objective:** Break up major hotspots (`PredictionDuelDetailPage`, `UserStats`, `InPlayPredictions`, `DraftControls`, `New`).
- **Risk:** Medium-High
- **Effort:** High
- **Benefits:** Lower cognitive complexity, easier review, improved testability.
- **Likely files affected:** room/duels, room/stats, prediction controls/forms.

### Phase 5 — Reusable UI extraction
- **Objective:** Extract repeated cards/lists/dialog shells and auth form shell.
- **Risk:** Low-Medium
- **Effort:** Medium
- **Benefits:** Reduced duplication, consistent UX behavior.
- **Likely files affected:** leaderboard, predictions phase views, auth pages, dialogs.

### Phase 6 — Cleanup and debt closure
- **Objective:** Remove dead files/dependencies, fix naming/import consistency, enforce lint rules.
- **Risk:** Low
- **Effort:** Low-Medium
- **Benefits:** Cleaner codebase and smaller maintenance footprint.
- **Likely files affected:** `package.json`, unused component files, import paths.

---

## 13. Proposed Target Architecture

### Recommended architecture
A **feature-first modular monolith** with:
- React + Vite + TypeScript
- TanStack Query as primary server-state layer
- Supabase API adapter modules per feature
- Tailwind + shared UI primitives

### Principles
- **High cohesion:** keep UI, hooks, types, and API adapters close to each feature.
- **Low coupling:** no cross-feature page-to-page imports; share only via `shared/*`.
- **Small units:** route pages should orchestrate, not contain full business workflows.
- **Stable contracts:** typed feature APIs from hooks/services; explicit query key contracts.
- **Scalable composition:** primitive UI in `shared/ui`, reusable feature composites in `features/*/components`.

### Target layering
1. **app/**: providers, routing, bootstrapping
2. **features/**: domain modules (`auth`, `rooms`, `predictions`, `duels`, `leaderboard`, `preferences`)
3. **shared/**: ui, hooks, lib, base types
4. **infrastructure adapters**: Supabase clients and feature API adapters (still in app codebase, but clearly separated)

This architecture best matches the app’s current complexity and growth path while preserving your existing stack choices.
