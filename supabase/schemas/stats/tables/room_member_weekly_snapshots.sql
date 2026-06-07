create table if not exists public.room_member_weekly_snapshots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  week_start date not null,
  total_won_in_room integer not null,
  prediction_rating integer not null,
  peak_prediction_rating integer not null,
  rated_predictions_count integer not null,
  current_streak integer not null,
  highest_streak integer not null,
  created_at timestamptz not null default now(),
  unique (room_id, player_id, week_start)
);

create index if not exists idx_room_member_weekly_snapshots_room_week
on public.room_member_weekly_snapshots (room_id, week_start);

create index if not exists idx_room_member_weekly_snapshots_player_week
on public.room_member_weekly_snapshots (player_id, week_start);
