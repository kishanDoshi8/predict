create or replace function public.get_latest_room_member_snapshot(
  p_room_id uuid,
  p_player_id uuid
)
returns table (
  week_start date,
  total_won_in_room integer,
  prediction_rating integer,
  peak_prediction_rating integer,
  rated_predictions_count integer,
  correct_predictions integer,
  total_predictions integer,
  current_streak integer,
  highest_streak integer
)
language sql
security definer
set search_path = public, private
as $$
  select
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
    and s.player_id = p_player_id
  order by s.week_start desc
  limit 1;
$$;
