create or replace function public.update_room_preferences(
  p_room_id             uuid,
  p_prediction_live     boolean default null,
  p_prediction_locked   boolean default null,
  p_deadline_1h         boolean default null,
  p_result_revealed     boolean default null,
  p_weekly_points_claim boolean default null,
  p_dark_mode           boolean default null,
  p_sounds_enabled      boolean default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_is_member boolean;
begin
  if p_dark_mode is false then
    raise exception 'Dark mode cannot be disabled' using errcode = 'P0001';
  end if;

  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_player_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'Access denied: you are not a member of this room' using errcode = 'P0011';
  end if;

  if p_prediction_live is null
    and p_prediction_locked is null
    and p_deadline_1h is null
    and p_result_revealed is null
    and p_weekly_points_claim is null
    and p_dark_mode is null
    and p_sounds_enabled is null
  then
    delete from public.room_preferences
    where room_id = p_room_id and player_id = v_player_id;
    return public.get_preferences(p_room_id);
  end if;

  insert into public.room_preferences (
    room_id, player_id, prediction_live, prediction_locked, deadline_1h,
    result_revealed, weekly_points_claim, dark_mode, sounds_enabled
  )
  values (
    p_room_id, v_player_id, p_prediction_live, p_prediction_locked, p_deadline_1h,
    p_result_revealed, p_weekly_points_claim, p_dark_mode, p_sounds_enabled
  )
  on conflict (room_id, player_id) do update
  set
    prediction_live     = excluded.prediction_live,
    prediction_locked   = excluded.prediction_locked,
    deadline_1h         = excluded.deadline_1h,
    result_revealed     = excluded.result_revealed,
    weekly_points_claim = excluded.weekly_points_claim,
    dark_mode           = excluded.dark_mode,
    sounds_enabled      = excluded.sounds_enabled,
    updated_at          = now();

  return public.get_preferences(p_room_id);
end;
$$;
