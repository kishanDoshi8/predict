create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  expected_games integer not null default 0 check (expected_games >= 0),
  created_by uuid not null references public.players(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  -- Players must bet on this many settled predictions to be ranked, win the title or get awards.
  min_bets_to_rank integer not null default 3 check (min_bets_to_rank between 0 and 50),
  -- Every member's wallet starts at starting_stack and gains weekly_topup each Monday if they bet the week before.
  starting_stack integer not null default 1000 check (starting_stack between 100 and 1000000),
  weekly_topup integer not null default 100 check (weekly_topup between 0 and 100000),
  topups_paid integer not null default 0 check (topups_paid >= 0),
  last_topup_week text,
  -- How many players the latest top-up reached, for the Monday push.
  last_topup_recipients integer not null default 0
);

create index if not exists idx_series_room_status on public.series(room_id, status, created_at desc);
create index if not exists idx_series_room_created_at on public.series(room_id, created_at desc);
