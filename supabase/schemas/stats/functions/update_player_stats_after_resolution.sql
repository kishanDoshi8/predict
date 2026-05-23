create or replace function public.update_player_stats_after_resolution(
  p_room_id uuid,
  p_prediction_id uuid,
  p_winning_option_id uuid,
  p_outcome text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform public.update_streaks_after_resolution(
    p_room_id,
    p_prediction_id,
    p_winning_option_id,
    p_outcome
  );

  insert into public.player_room_stats (room_id, user_id, stat_key, stat_value_json)
  select
    rm.room_id,
    rm.player_id,
    'current_streak',
    jsonb_build_object(
      'streak', rm.current_streak,
      'user_id', rm.player_id,
      'username', p.username
    )
  from public.room_members rm
  join public.players p on p.id = rm.player_id
  where rm.room_id = p_room_id
  on conflict (room_id, user_id, stat_key)
  do update
  set stat_value_json = excluded.stat_value_json,
      updated_at = now();

  insert into public.player_room_stats (room_id, user_id, stat_key, stat_value_json)
  select
    rm.room_id,
    rm.player_id,
    'highest_streak',
    jsonb_build_object(
      'streak', rm.highest_streak,
      'user_id', rm.player_id,
      'username', p.username
    )
  from public.room_members rm
  join public.players p on p.id = rm.player_id
  where rm.room_id = p_room_id
  on conflict (room_id, user_id, stat_key)
  do update
  set stat_value_json = excluded.stat_value_json,
      updated_at = now();

  perform private.refresh_room_featured_streaks(p_room_id);
end;
$$;
