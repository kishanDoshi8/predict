-- A series' points standings: ranked players by balance, then winning bets,
-- then who joined first. Same rule as get_series_leaderboard's points sort
-- (tests keep the two in step). Unranked players get a null rank.
create or replace function private.series_standings(
  p_series_id uuid
)
returns table (
  player_id uuid,
  rank integer,
  is_ranked boolean,
  balance integer
)
language sql
stable
security definer
set search_path = public, private
as $$
  with series as (
    select s.id, s.room_id, s.starting_stack, private.series_required_bets(s.id) as required
    from public.series s
    where s.id = p_series_id
  ),
  stats as (
    select st.*
    from series se
    cross join lateral private.get_leaderboard_player_stats(se.room_id, se.id, false) st
  ),
  members as (
    select
      rm.player_id,
      rm.joined_at,
      coalesce(w.balance, se.starting_stack + coalesce(st.net_profit, 0)::int) as balance,
      coalesce(st.winning_bets, 0) as winning_bets,
      coalesce(st.total_bets, 0) >= se.required as is_ranked
    from series se
    join public.room_members rm on rm.room_id = se.room_id
    left join stats st on st.player_id = rm.player_id
    left join public.series_wallets w on w.series_id = se.id and w.player_id = rm.player_id
  )
  select
    m.player_id,
    case when m.is_ranked then (rank() over (
      partition by m.is_ranked
      order by m.balance desc, m.winning_bets desc, m.joined_at asc
    ))::int end as rank,
    m.is_ranked,
    m.balance
  from members m;
$$;
