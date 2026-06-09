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

  with stats as (
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
  ),
  latest_snapshots as (
    select distinct on (s.player_id)
      s.player_id,
      s.week_start,
      s.total_won_in_room,
      s.prediction_rating,
      s.peak_prediction_rating,
      s.rated_predictions_count,
      s.correct_predictions,
      s.total_predictions,
      s.current_streak,
      s.highest_streak
    from public.room_member_weekly_snapshots s
    where s.room_id = p_room_id
    order by s.player_id, s.week_start desc
  ),
  base_current as (
    select
      rm.player_id,
      p.username,
      rm.total_won_in_room,
      rm.total_won_in_room as current_total_won_in_room,
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
      case
        when coalesce(s.total_revealed_bets, 0) > 0 then
          coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets
      end as accuracy_ratio
    from public.room_members rm
    join public.players p on p.id = rm.player_id
    left join stats s on s.player_id = rm.player_id
    where rm.room_id = p_room_id
  ),
  current_ranked as (
    select
      bc.*,
      rank() over (
        order by
          case when p_sort_by = 'points' then bc.total_won_in_room end desc nulls last,
          case when p_sort_by = 'points' then bc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'rating' then bc.prediction_rating end desc nulls last,
          case when p_sort_by = 'rating' then bc.rated_predictions_count end desc nulls last,
          case when p_sort_by = 'accuracy' then bc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'accuracy' then bc.total_revealed_bets end desc nulls last,
          case when p_sort_by = 'streak' then bc.current_streak end desc nulls last,
          case when p_sort_by = 'streak' then bc.highest_streak end desc nulls last,
          bc.joined_at asc
      ) as rank
    from base_current bc
  ),
  previous_candidates as (
    select
      bc.player_id,
      bc.joined_at,
      ls.total_won_in_room,
      ls.prediction_rating,
      ls.rated_predictions_count,
      ls.correct_predictions,
      ls.total_predictions,
      ls.current_streak,
      ls.highest_streak,
      case
        when ls.total_predictions > 0 then ls.correct_predictions::numeric / ls.total_predictions
      end as accuracy_ratio
    from base_current bc
    join latest_snapshots ls on ls.player_id = bc.player_id
  ),
  previous_ranked as (
    select
      pc.player_id,
      rank() over (
        order by
          case when p_sort_by = 'points' then pc.total_won_in_room end desc nulls last,
          case when p_sort_by = 'points' then pc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'rating' then pc.prediction_rating end desc nulls last,
          case when p_sort_by = 'rating' then pc.rated_predictions_count end desc nulls last,
          case when p_sort_by = 'accuracy' then pc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'accuracy' then pc.total_predictions end desc nulls last,
          case when p_sort_by = 'streak' then pc.current_streak end desc nulls last,
          case when p_sort_by = 'streak' then pc.highest_streak end desc nulls last,
          pc.joined_at asc
      ) as previous_rank
    from previous_candidates pc
  )
  select json_agg(lb order by lb.rank)
  into v_result
  from (
    select
      cr.player_id,
      cr.username,
      cr.total_won_in_room,
      cr.joined_at,
      cr.is_organizer,
      cr.current_streak,
      cr.highest_streak,
      cr.prediction_rating,
      cr.peak_prediction_rating,
      cr.rated_predictions_count,
      cr.total_bets,
      cr.total_revealed_bets,
      cr.winning_bets,
      cr.total_wagered,
      cr.total_payout,
      cr.net_points,
      cr.win_percentage,
      cr.rank,
      pr.previous_rank,
      case
        when pr.previous_rank is not null then pr.previous_rank - cr.rank
      end as rank_change,
      ls.prediction_rating as previous_prediction_rating,
      case
        when ls.player_id is not null then cr.prediction_rating - ls.prediction_rating
      end as rating_change,
      ls.total_won_in_room as previous_total_won_in_room,
      case
        when ls.player_id is not null then cr.current_total_won_in_room - ls.total_won_in_room
      end as points_change
    from current_ranked cr
    left join latest_snapshots ls on ls.player_id = cr.player_id
    left join previous_ranked pr on pr.player_id = cr.player_id
  ) lb;

  return coalesce(v_result, '[]'::json);
end;
$$;
