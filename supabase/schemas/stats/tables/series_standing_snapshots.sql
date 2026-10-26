-- One row per member per week: where they stood when week_key began, i.e.
-- the final standings of the week before. Written by the Monday cron.
create table if not exists public.series_standing_snapshots (
  series_id  uuid not null references public.series(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  week_key   text not null,
  rank       integer,
  is_ranked  boolean not null,
  balance    integer not null,
  created_at timestamptz not null default now(),
  primary key (series_id, player_id, week_key)
);
