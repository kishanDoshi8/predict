create table if not exists public.room_activities (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  activity_type text not null,
  activity_tier smallint not null check (activity_tier between 1 and 3),
  metadata jsonb not null default '{}'::jsonb,
  click_action jsonb,
  created_by_player_id uuid references public.players(id) on delete set null,
  dedupe_key text,
  created_at timestamptz not null default now()
);

create index if not exists idx_room_activities_room_created
  on public.room_activities (room_id, created_at desc, id desc);

create index if not exists idx_room_activities_room_type_created
  on public.room_activities (room_id, activity_type, created_at desc, id desc);

create unique index if not exists uq_room_activities_room_dedupe
  on public.room_activities (room_id, dedupe_key)
  where dedupe_key is not null;
