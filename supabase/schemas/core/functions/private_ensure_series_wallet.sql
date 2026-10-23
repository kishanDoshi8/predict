-- Gives a player their wallet for a series if they don't have one yet.
-- Late joiners get the stack plus every top-up already paid, so they start level.
create or replace function private.ensure_series_wallet(
  p_series_id uuid,
  p_player_id uuid
)
returns void
language sql
security definer
set search_path = public, private
as $$
  insert into public.series_wallets (series_id, player_id, balance, granted)
  select
    s.id,
    p_player_id,
    s.starting_stack + s.weekly_topup * s.topups_paid,
    s.starting_stack + s.weekly_topup * s.topups_paid
  from public.series s
  where s.id = p_series_id
    and s.status = 'active'
  on conflict (series_id, player_id) do nothing;
$$;
