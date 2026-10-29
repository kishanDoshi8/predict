-- Gives a player their wallet for a series if they don't have one yet.
-- A late joiner starts with what the least-topped-up active player has been
-- granted: some catch-up, but never more than a player who skipped weeks.
-- Active means they've bet in the series; with no bettors yet, it's the stack.
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
  select s.id, p_player_id, start.points, start.points
  from public.series s
  cross join lateral (
    select least(
      greatest(
        coalesce(
          (
            select min(w.granted)
            from public.series_wallets w
            where w.series_id = s.id
              and exists (
                select 1
                from public.bets b
                join public.predictions p on p.id = b.prediction_id
                where p.series_id = s.id
                  and b.player_id = w.player_id
              )
          ),
          s.starting_stack
        ),
        s.starting_stack
      ),
      s.starting_stack + s.weekly_topup * s.topups_paid
    ) as points
  ) start
  where s.id = p_series_id
    and s.status = 'active'
  on conflict (series_id, player_id) do nothing;
$$;
