create or replace function public.create_weekly_room_member_snapshots()
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_week_start date;
  v_inserted_count integer := 0;
begin
  -- date_trunc('week', ...) uses Monday as the ISO week boundary.
  -- We truncate in UTC to keep snapshot boundaries timezone-stable.
  v_week_start := (date_trunc('week', now() at time zone 'UTC'))::date;

  with accuracy_stats as (
    select
      pred.room_id,
      b.player_id,
      count(*) filter (where pred.status = 'revealed') as total_predictions,
      count(*) filter (
        where pred.status = 'revealed'
          and b.option_id = pred.winning_option_id
      ) as correct_predictions
    from public.bets b
    join public.predictions pred on pred.id = b.prediction_id
    where pred.status in ('revealed', 'cancelled', 'no_result')
    group by pred.room_id, b.player_id
  )
  insert into public.room_member_weekly_snapshots (
    room_id,
    player_id,
    week_start,
    total_won_in_room,
    prediction_rating,
    peak_prediction_rating,
    rated_predictions_count,
    correct_predictions,
    total_predictions,
    current_streak,
    highest_streak
  )
  select
    rm.room_id,
    rm.player_id,
    v_week_start,
    rm.total_won_in_room,
    rm.prediction_rating,
    rm.peak_prediction_rating,
    rm.rated_predictions_count,
    coalesce(a.correct_predictions, 0),
    coalesce(a.total_predictions, 0),
    rm.current_streak,
    rm.highest_streak
  from public.room_members rm
  left join accuracy_stats a
    on a.room_id = rm.room_id
   and a.player_id = rm.player_id
  on conflict (room_id, player_id, week_start) do nothing;

  get diagnostics v_inserted_count = row_count;

  return json_build_object('snapshots_created', v_inserted_count);
end;
$$;
