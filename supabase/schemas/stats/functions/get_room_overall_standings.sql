-- Standings across every series in a room. Each series starts everyone with the
-- same points, so profit summed over series is comparable between players.
-- Ranked by total profit, then titles won, then winning picks.
create or replace function public.get_room_overall_standings(
  p_room_id uuid
)
returns json
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_result json;
begin
  if private.get_player_id_from_auth() is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not private.is_room_member(p_room_id) then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  with bet_stats as (
    select
      b.player_id,
      count(distinct pred.series_id)::int as series_played,
      count(*) filter (where pred.status = 'revealed')::int as total_revealed_bets,
      count(*) filter (
        where pred.status = 'revealed'
          and b.option_id = pred.winning_option_id
      )::int as winning_bets,
      coalesce(sum(coalesce(b.payout, 0) - b.amount) filter (
        where pred.status in ('revealed', 'no_result')
      ), 0)::int as net_profit
    from public.bets b
    join public.predictions pred on pred.id = b.prediction_id
    where pred.room_id = p_room_id
      and pred.series_id is not null
    group by b.player_id
  ),
  titles as (
    select
      sp.player_id,
      count(*) filter (where sp.placement = 1)::int as titles,
      count(*)::int as podiums
    from public.series_placements sp
    join public.series s on s.id = sp.series_id
    where s.room_id = p_room_id
    group by sp.player_id
  ),
  ranked as (
    select
      rm.player_id,
      p.username,
      rm.joined_at,
      rm.current_streak,
      coalesce(bs.net_profit, 0) as net_profit,
      coalesce(bs.series_played, 0) as series_played,
      coalesce(bs.total_revealed_bets, 0) as total_revealed_bets,
      coalesce(bs.winning_bets, 0) as winning_bets,
      coalesce(t.titles, 0) as titles,
      coalesce(t.podiums, 0) as podiums,
      rank() over (
        order by
          coalesce(bs.net_profit, 0) desc,
          coalesce(t.titles, 0) desc,
          coalesce(bs.winning_bets, 0) desc
      ) as rank
    from public.room_members rm
    join public.players p on p.id = rm.player_id
    left join bet_stats bs on bs.player_id = rm.player_id
    left join titles t on t.player_id = rm.player_id
    where rm.room_id = p_room_id
  )
  select coalesce(json_agg(row_to_json(r) order by r.rank, r.joined_at), '[]'::json)
  into v_result
  from ranked r;

  return v_result;
end;
$$;
