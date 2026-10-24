-- One row each time a player shares something from a room, so we can see
-- which shareables get used. Written only through public.record_share.
create table if not exists public.share_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  kind text not null check (kind ~ '^[a-z][a-z-]{0,31}$'),
  created_at timestamptz not null default now()
);
create index if not exists idx_share_events_room_created on public.share_events(room_id, created_at desc);

alter table public.share_events enable row level security;
revoke all on public.share_events from anon, authenticated;
