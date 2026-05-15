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

4. Deploy the function (JWT verification is now enabled):

```bash
supabase functions deploy send-push-notifications
```

5. Populate the notification config table (run once in the Supabase SQL editor):

```sql
insert into private.notification_config (key, value)
values
  ('supabase_url',                 'https://YOUR_PROJECT_REF.supabase.co'),
  ('notification_function_secret', 'YOUR_NOTIFICATION_FUNCTION_SECRET'),
  ('app_url',                      'https://YOUR_APP_URL'),
  ('service_role_key',             'YOUR_SERVICE_ROLE_KEY')
on conflict (key) do update set value = excluded.value;
```

   - `supabase_url` — your project URL (same as `SUPABASE_URL` in the dashboard)
   - `notification_function_secret` — the same value used for `NOTIFICATION_FUNCTION_SECRET` in step 3
   - `app_url` — the public URL of your deployed frontend (e.g. `https://predict.vercel.app`)
   - `service_role_key` — the **service_role** JWT from **Settings > API** in the Supabase dashboard; allows database triggers to authenticate when calling the edge function with JWT verification enabled

6. Enable the cron jobs (run once in the SQL editor, requires `pg_cron` extension):

```sql
-- Poll every minute for predictions whose deadline is within the next hour.
select cron.schedule(
  'push-deadline-1h',
  '* * * * *',
  $cron$
    select private.fire_push_notification_for_deadline_1h();
  $cron$
);

-- Notify all opted-in players every Monday at 08:00 UTC that weekly points are claimable.
select cron.schedule(
  'push-weekly-points-claim',
  '0 8 * * 1',
  $cron$
    select private.fire_push_notification(
      'weekly_points_claim', null, null,
      '💰 Weekly Points Available!',
      'Claim your 100 free points now.',
      '/'
    );
  $cron$
);
```

7. Frontend test trigger example:

```ts
import { sendPushNotificationTrigger } from "@/lib/api";

await sendPushNotificationTrigger({
  event_type: "prediction_live",
  payload: {
    title: "Predikt test notification",
    body: "Push notifications are working.",
    url: window.location.pathname,
  },
});
```

8. Inspect notification delivery:

```sql
-- Recent dispatch attempts (shows pg_net request IDs)
select * from private.notification_dispatch_log order by created_at desc limit 20;

-- Cross-reference with actual HTTP responses
select l.event_type, l.created_at, r.status_code, r.content
from private.notification_dispatch_log l
join net._http_response r on r.id = l.http_request_id
order by l.created_at desc
limit 20;
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
