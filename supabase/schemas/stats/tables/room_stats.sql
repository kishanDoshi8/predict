create table if not exists public.room_stats (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  stat_key text not null,
  stat_value_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, stat_key)
);
create index if not exists idx_room_stats_room_key on public.room_stats (room_id, stat_key);
