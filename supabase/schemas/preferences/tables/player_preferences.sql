create table if not exists public.player_preferences (
  player_id uuid primary key references public.players(id) on delete cascade,
  prediction_live boolean not null default true,
  prediction_locked boolean not null default true,
  deadline_1h boolean not null default true,
  result_revealed boolean not null default true,
  weekly_points_claim boolean not null default true,
  dark_mode boolean not null default true,
  sounds_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  has_seen_how_to_play boolean not null default false,
  has_seen_ratings_tip boolean not null default false,
  check (dark_mode = true)
);
