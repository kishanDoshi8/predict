create or replace function public.update_global_preferences(
  p_prediction_live     boolean,
  p_prediction_locked   boolean,
  p_deadline_1h         boolean,
  p_result_revealed     boolean,
  p_weekly_points_claim boolean,
  p_dark_mode           boolean,
  p_sounds_enabled      boolean
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
begin
  if p_dark_mode is distinct from true then
    raise exception 'Dark mode cannot be disabled' using errcode = 'P0001';
  end if;

  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  insert into public.player_preferences (
    player_id, prediction_live, prediction_locked, deadline_1h,
    result_revealed, weekly_points_claim, dark_mode, sounds_enabled
  )
  values (
    v_player_id, p_prediction_live, p_prediction_locked, p_deadline_1h,
    p_result_revealed, p_weekly_points_claim, p_dark_mode, p_sounds_enabled
  )
  on conflict (player_id) do update
  set
    prediction_live     = excluded.prediction_live,
    prediction_locked   = excluded.prediction_locked,
    deadline_1h         = excluded.deadline_1h,
    result_revealed     = excluded.result_revealed,
    weekly_points_claim = excluded.weekly_points_claim,
    dark_mode           = excluded.dark_mode,
    sounds_enabled      = excluded.sounds_enabled,
    updated_at          = now();

  return public.get_preferences(null);
end;
$$;
