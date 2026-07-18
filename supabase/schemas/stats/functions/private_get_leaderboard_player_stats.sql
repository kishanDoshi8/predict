create or replace function private.get_leaderboard_player_stats(
  p_room_id uuid,
  p_series_id uuid default null,
  p_include_cancelled boolean default true
)
returns table (
  player_id uuid,
  total_bets bigint,
  total_revealed_bets bigint,
  winning_bets bigint,
  total_wagered numeric,
  total_payout numeric,
  total_profit numeric,
  total_loss numeric,
  net_profit numeric
)
language sql
stable
set search_path = public
as $$
  select
    b.player_id,
    count(*) as total_bets,
    count(*) filter (where pred.status = 'revealed') as total_revealed_bets,
    count(*) filter (
      where pred.status = 'revealed'
        and b.option_id = pred.winning_option_id
    ) as winning_bets,
    sum(b.amount) as total_wagered,
    sum(coalesce(b.payout, 0)) as total_payout,
    sum(greatest(coalesce(b.payout, 0) - b.amount, 0)) as total_profit,
    sum(greatest(b.amount - coalesce(b.payout, 0), 0)) as total_loss,
    sum(coalesce(b.payout, 0) - b.amount) as net_profit
  from public.bets b
  join public.predictions pred on pred.id = b.prediction_id
  where pred.room_id = p_room_id
    and (p_series_id is null or pred.series_id = p_series_id)
    and (
      pred.status in ('revealed', 'no_result')
      or (p_include_cancelled and pred.status = 'cancelled')
    )
  group by b.player_id;
$$;
