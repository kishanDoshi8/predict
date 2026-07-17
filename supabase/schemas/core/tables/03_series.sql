create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  expected_games integer not null default 0 check (expected_games >= 0),
  prediction_count integer not null default 0 check (prediction_count >= 0),
  completed_games integer not null default 0 check (completed_games >= 0),
  created_by uuid not null references public.players(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz
);

create index if not exists idx_series_room_status on public.series(room_id, status, created_at desc);
create index if not exists idx_series_room_created_at on public.series(room_id, created_at desc);
