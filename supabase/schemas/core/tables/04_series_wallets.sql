-- Points live per series: one wallet per player per series.
create table if not exists public.series_wallets (
  series_id uuid not null references public.series(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  balance integer not null check (balance >= 0),
  escrow integer not null default 0 check (escrow >= 0),
  -- Starting stack plus every top-up received, so net profit is balance - granted.
  granted integer not null check (granted >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (series_id, player_id),
  constraint series_wallets_escrow_within_balance check (escrow <= balance)
);

create index if not exists idx_series_wallets_player on public.series_wallets(player_id);
