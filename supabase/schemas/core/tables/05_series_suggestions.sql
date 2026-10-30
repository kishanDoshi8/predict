-- "Up next": ideas for a room's next series, and who backs them.
create table if not exists public.series_suggestions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  created_by uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- open: on the board; played: became a series; removed: taken down.
  status text not null default 'open' check (status in ('open', 'played', 'removed')),
  series_id uuid references public.series(id) on delete set null
);

-- One open idea per title in a room, whatever the capitals.
create unique index if not exists uq_series_suggestions_open_title
  on public.series_suggestions (room_id, lower(title))
  where status = 'open';
create index if not exists idx_series_suggestions_room_status
  on public.series_suggestions (room_id, status);

create table if not exists public.series_suggestion_votes (
  suggestion_id uuid not null references public.series_suggestions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, player_id)
);
