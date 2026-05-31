create or replace function public.get_room_leaderboard(p_room_id uuid)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_result    json;
begin
  -- Resolve caller from JWT
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  -- Enforce room membership
  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  -- Build ranked leaderboard
  select json_agg(lb order by lb.rank)
  into v_result
  from (
    select
      rm.player_id,
      p.username,
      rm.total_won_in_room,
      rm.joined_at,
      rm.is_organizer,
      rm.current_streak,
      rm.highest_streak,
      -- Bet aggregates scoped to this room
      coalesce(s.total_bets,         0)  as total_bets,
      coalesce(s.total_revealed_bets,0)  as total_revealed_bets,
      coalesce(s.winning_bets,       0)  as winning_bets,
      coalesce(s.total_wagered,      0)  as total_wagered,
      coalesce(s.total_payout,       0)  as total_payout,
      -- Net gain/loss in this room
      coalesce(s.total_payout, 0) - coalesce(s.total_wagered, 0) as net_points,
      -- Win percentage over revealed predictions only
      case
        when coalesce(s.total_revealed_bets, 0) > 0
          then round(
            (coalesce(s.winning_bets, 0)::numeric
              / s.total_revealed_bets) * 100,
            1
          )
        else 0
      end as win_percentage,
      -- Rank: primary = most points won, secondary = win rate, tertiary = earliest join
      rank() over (
        order by
          rm.total_won_in_room desc,
          case
            when coalesce(s.total_revealed_bets, 0) > 0
              then (coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets)
            else 0
          end desc,
          rm.joined_at asc
      ) as rank
    from public.room_members rm
    join public.players p on p.id = rm.player_id
    left join (
      select
        b.player_id,
        count(*)                                                                  as total_bets,
        count(*) filter (where pred.status = 'revealed')                          as total_revealed_bets,
        count(*) filter (
          where pred.status = 'revealed'
            and b.option_id = pred.winning_option_id
        )                                                                          as winning_bets,
        sum(b.amount)                                                              as total_wagered,
        sum(coalesce(b.payout, 0))                                                 as total_payout
      from public.bets b
      join public.predictions pred on pred.id = b.prediction_id
      where pred.room_id = p_room_id
        and pred.status in ('revealed', 'cancelled', 'no_result')
      group by b.player_id
    ) s on s.player_id = rm.player_id
    where rm.room_id = p_room_id
  ) lb;

  return coalesce(v_result, '[]'::json);
end;
$$;
