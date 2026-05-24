create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.players(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_user_push_subscriptions_endpoint on public.user_push_subscriptions ((subscription->>'endpoint'));
create index if not exists idx_user_push_subscriptions_user_id on public.user_push_subscriptions(user_id);
