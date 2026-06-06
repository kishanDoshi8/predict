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

  insert into public.room_member_weekly_snapshots (
    room_id,
    player_id,
    week_start,
    total_won_in_room,
    prediction_rating,
    peak_prediction_rating,
    rated_predictions_count,
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
    rm.current_streak,
    rm.highest_streak
  from public.room_members rm
  on conflict (room_id, player_id, week_start) do nothing;

  get diagnostics v_inserted_count = row_count;

  return json_build_object('snapshots_created', v_inserted_count);
end;
$$;
