alter table public.series_wallets enable row level security;
revoke all on public.series_wallets from anon;
revoke insert, update, delete, truncate, references, trigger on public.series_wallets from authenticated;

drop policy if exists "series_wallets_select" on public.series_wallets;
create policy "series_wallets_select" on public.series_wallets for select to authenticated using (private.can_view_series(series_id));

grant select (series_id, player_id, balance, escrow, granted, created_at, updated_at) on public.series_wallets to authenticated;
