-- What a player has already seen on Home, so it isn't shown again.
-- Results: one row per settled prediction the player dismissed.
create table if not exists public.result_seen (
  player_id uuid not null references public.players(id) on delete cascade,
  prediction_id uuid not null references public.predictions(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (player_id, prediction_id)
);

-- Weekly recaps: one row per series week the player dismissed.
create table if not exists public.weekly_recap_seen (
  player_id uuid not null references public.players(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  week_key text not null,
  seen_at timestamptz not null default now(),
  primary key (player_id, series_id, week_key)
);
