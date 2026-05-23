create table if not exists public.player_room_stats (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.players(id) on delete cascade,
  stat_key text not null,
  stat_value_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, user_id, stat_key)
);
create index if not exists idx_player_room_stats_room_user_key on public.player_room_stats (room_id, user_id, stat_key);
create index if not exists idx_player_room_stats_room_key on public.player_room_stats (room_id, stat_key);
