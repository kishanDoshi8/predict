create or replace function public.get_room_leaderboard(
  p_room_id uuid,
  p_sort_by text default 'points'
)
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
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  if p_sort_by not in ('points', 'rating', 'accuracy', 'streak') then
    raise exception 'Invalid sort mode: %', p_sort_by using errcode = 'P0001';
  end if;

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
      rm.prediction_rating,
      rm.peak_prediction_rating,
      rm.rated_predictions_count,
      coalesce(s.total_bets, 0) as total_bets,
      coalesce(s.total_revealed_bets, 0) as total_revealed_bets,
      coalesce(s.winning_bets, 0) as winning_bets,
      coalesce(s.total_wagered, 0) as total_wagered,
      coalesce(s.total_payout, 0) as total_payout,
      coalesce(s.total_payout, 0) - coalesce(s.total_wagered, 0) as net_points,
      case
        when coalesce(s.total_revealed_bets, 0) > 0 then
          round((coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets) * 100, 1)
        else 0
      end as win_percentage,
      rank() over (
        order by
          case when p_sort_by = 'points' then rm.total_won_in_room end desc nulls last,
          case when p_sort_by = 'points' and coalesce(s.total_revealed_bets, 0) > 0
            then (coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets)
          end desc nulls last,
          case when p_sort_by = 'rating' then rm.prediction_rating end desc nulls last,
          case when p_sort_by = 'rating' then rm.rated_predictions_count end desc nulls last,
          case when p_sort_by = 'accuracy' and coalesce(s.total_revealed_bets, 0) > 0
            then (coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets)
          end desc nulls last,
          case when p_sort_by = 'accuracy' then coalesce(s.total_revealed_bets, 0) end desc nulls last,
          case when p_sort_by = 'streak' then rm.current_streak end desc nulls last,
          case when p_sort_by = 'streak' then rm.highest_streak end desc nulls last,
          rm.joined_at asc
      ) as rank
    from public.room_members rm
    join public.players p on p.id = rm.player_id
    left join (
      select
        b.player_id,
        count(*) as total_bets,
        count(*) filter (where pred.status = 'revealed') as total_revealed_bets,
        count(*) filter (
          where pred.status = 'revealed'
            and b.option_id = pred.winning_option_id
        ) as winning_bets,
        sum(b.amount) as total_wagered,
        sum(coalesce(b.payout, 0)) as total_payout
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
