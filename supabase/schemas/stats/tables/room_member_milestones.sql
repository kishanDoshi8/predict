-- Career milestones: personal bars a player clears once per room, apart from
-- the competitive series awards. Granted by private.award_milestones.
create table if not exists public.room_member_milestones (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  milestone_type text not null check (milestone_type in (
    'FIRST_TITLE', 'HAT_TRICK', 'BACK_TO_BACK', 'CENTURY', 'MOONSHOT', 'IRON_SEASON'
  )),
  -- When the bar was first cleared, and the series it was cleared in, if any.
  achieved_at timestamptz not null,
  series_id uuid references public.series(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (room_id, player_id, milestone_type)
);

create index if not exists idx_room_member_milestones_room_player
  on public.room_member_milestones (room_id, player_id, achieved_at desc);
