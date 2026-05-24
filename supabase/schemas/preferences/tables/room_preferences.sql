create table if not exists public.room_preferences (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  prediction_live boolean,
  prediction_locked boolean,
  deadline_1h boolean,
  result_revealed boolean,
  weekly_points_claim boolean,
  dark_mode boolean,
  sounds_enabled boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, player_id),
  check (dark_mode is null or dark_mode = true)
);
create index if not exists idx_room_preferences_room_player on public.room_preferences(room_id, player_id);
create index if not exists idx_room_preferences_player on public.room_preferences(player_id);
