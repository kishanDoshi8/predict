create table if not exists public.weekly_claims (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  week_key text not null,
  auto_claimed boolean not null default false,
  claimed_at timestamptz not null default now(),
  unique (player_id, week_key)
);
