create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  is_organizer boolean not null default false,
  total_won_in_room integer not null default 0,
  joined_at timestamptz not null default now(),
  current_streak integer not null default 0 check (current_streak >= 0),
  highest_streak integer not null default 0 check (highest_streak >= 0),
  unique (room_id, player_id)
);
create index if not exists idx_room_members_room_id on public.room_members(room_id);
create index if not exists idx_room_members_player_id on public.room_members(player_id);
create index if not exists idx_room_members_leaderboard on public.room_members(room_id, total_won_in_room desc);
