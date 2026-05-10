# Predikt

Private prediction game. Friends bet weekly points on real-life outcomes.

## Stack
- **Frontend**: React + Vite + TypeScript (PWA)
- **Backend**: Supabase (Postgres + Realtime)
- **Hosting**: Vercel + Supabase Cloud

---

## Setup

### 1. Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the dashboard: **Database > Extensions** — enable `pgcrypto` and `pg_cron`
3. Copy your project URL and anon key from **Settings > API**

### 2. Run migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase login
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push
```

Or run each file manually in the Supabase SQL editor in order:
- `001_initial_schema.sql`
- `002_rls_policies.sql`
- `003_rpc_functions.sql`
- `004_resolve_and_payout.sql`

### 3. Enable the auto-lock cron job

In the Supabase SQL editor, run the cron schedule from the bottom of `004_resolve_and_payout.sql` (it's commented out — uncomment and run it once).

### 4. Frontend

```bash
# Install dependencies
npm install

# Copy env template and fill in your Supabase values
cp apps/web/.env.example apps/web/.env.local

# Start dev server
npm run dev
```

### 5. Generate TypeScript types (optional but recommended)

```bash
npm run db:types
```

This generates `apps/web/src/types/supabase.ts` from your live DB schema.

### 6. Browser push notifications

1. Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

2. Add the public key in `apps/web/.env.local`:

```bash
VITE_WEB_PUSH_PUBLIC_KEY=YOUR_PUBLIC_VAPID_KEY
```

3. Set Edge Function secrets:

```bash
supabase secrets set WEB_PUSH_PUBLIC_KEY=YOUR_PUBLIC_VAPID_KEY
supabase secrets set WEB_PUSH_PRIVATE_KEY=YOUR_PRIVATE_VAPID_KEY
supabase secrets set WEB_PUSH_SUBJECT=mailto:you@example.com
supabase secrets set NOTIFICATION_FUNCTION_SECRET=YOUR_STRONG_RANDOM_SECRET
```

4. Deploy the function:

```bash
supabase functions deploy send-push-notifications --no-verify-jwt
```

5. Frontend test trigger example:

```ts
import { sendPushNotificationTrigger } from "@/lib/api";

await sendPushNotificationTrigger({
  event_type: "prediction_live",
  payload: {
    title: "Predikt test notification",
    body: "Push notifications are working.",
    url: window.location.pathname,
  },
  target_player_token: localStorage.getItem("predikt") ?? "",
});
```

---

## Project Structure

```
predikt/
├── apps/
│   └── web/                      # React PWA
│       └── src/
│           ├── components/
│           │   ├── ui/           # Generic primitives (Button, Input, Modal...)
│           │   ├── room/         # Room-level UI (PlayerList, ClaimBanner...)
│           │   ├── prediction/   # Prediction lifecycle (DraftView, LockedView...)
│           │   └── leaderboard/  # Leaderboard components
│           ├── hooks/
│           │   ├── useRoomRealtime.ts   # Supabase Realtime subscriptions
│           │   └── useWeeklyClaim.ts    # Weekly points claim logic
│           ├── lib/
│           │   ├── supabase.ts   # Supabase client
│           │   ├── api.ts        # All API calls (RPC wrappers)
│           │   └── storage.ts    # localStorage helpers (tokens, auto-claim)
│           ├── pages/            # Route-level components
│           ├── store/
│           │   └── useAppStore.ts  # Zustand global state
│           └── types/
│               └── supabase.ts   # Auto-generated from DB (npm run db:types)
└── supabase/
    ├── config.toml
    ├── seed.sql
    └── migrations/
        ├── 001_initial_schema.sql    # Tables + indexes
        ├── 002_rls_policies.sql      # RLS + safe views
        ├── 003_rpc_functions.sql     # Game logic RPCs
        └── 004_resolve_and_payout.sql # Resolution + payout + cron
```

---

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Auth | Token-based (localStorage) | No login friction |
| Identity | player_token + organizer_token | Separate concerns |
| Writes | Via RPC only | Enforces game rules server-side |
| Reads | Via safe views | Strips tokens, hides draft bets |
| Realtime | Postgres Changes + Presence | Live pool updates, online status |
| Points | Additive drip, never reset | No deadline pressure, natural retention |
| Payout rounding | `floor()` always | Avoids floating point drift |
