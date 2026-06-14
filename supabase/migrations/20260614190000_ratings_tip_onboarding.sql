-- ============================================================
-- Migration: ratings_tip_onboarding
-- Description:
--   Adds has_seen_ratings_tip to player_preferences,
--   exposes it in get_preferences, and provides
--   a mark_ratings_tip_seen RPC.
-- ============================================================

alter table public.player_preferences
add column if not exists has_seen_ratings_tip boolean not null default false;

create or replace function public.get_preferences(
  p_room_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_is_member boolean;
  v_global    public.player_preferences%rowtype;
  v_room      public.room_preferences%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  if p_room_id is not null then
    select exists (
      select 1 from public.room_members
      where room_id = p_room_id and player_id = v_player_id
    ) into v_is_member;

    if not v_is_member then
      raise exception 'Access denied: you are not a member of this room' using errcode = 'P0011';
    end if;
  end if;

  insert into public.player_preferences (player_id)
  values (v_player_id)
  on conflict (player_id) do nothing;

  select * into v_global
  from public.player_preferences
  where player_id = v_player_id;

  if p_room_id is not null then
    select * into v_room
    from public.room_preferences
    where room_id = p_room_id and player_id = v_player_id;
  end if;

  return json_build_object(
    'room_id', p_room_id,
    'has_seen_how_to_play', v_global.has_seen_how_to_play,
    'has_seen_ratings_tip', v_global.has_seen_ratings_tip,
    'global', json_build_object(
      'prediction_live',     v_global.prediction_live,
      'prediction_locked',   v_global.prediction_locked,
      'deadline_1h',         v_global.deadline_1h,
      'result_revealed',     v_global.result_revealed,
      'weekly_points_claim', v_global.weekly_points_claim,
      'dark_mode',           v_global.dark_mode,
      'sounds_enabled',      v_global.sounds_enabled
    ),
    'room_overrides', json_build_object(
      'prediction_live',     case when v_room.id is null then null else v_room.prediction_live end,
      'prediction_locked',   case when v_room.id is null then null else v_room.prediction_locked end,
      'deadline_1h',         case when v_room.id is null then null else v_room.deadline_1h end,
      'result_revealed',     case when v_room.id is null then null else v_room.result_revealed end,
      'weekly_points_claim', case when v_room.id is null then null else v_room.weekly_points_claim end,
      'dark_mode',           case when v_room.id is null then null else v_room.dark_mode end,
      'sounds_enabled',      case when v_room.id is null then null else v_room.sounds_enabled end
    ),
    'effective', json_build_object(
      'prediction_live',     coalesce(v_room.prediction_live, v_global.prediction_live),
      'prediction_locked',   coalesce(v_room.prediction_locked, v_global.prediction_locked),
      'deadline_1h',         coalesce(v_room.deadline_1h, v_global.deadline_1h),
      'result_revealed',     coalesce(v_room.result_revealed, v_global.result_revealed),
      'weekly_points_claim', coalesce(v_room.weekly_points_claim, v_global.weekly_points_claim),
      'dark_mode',           coalesce(v_room.dark_mode, v_global.dark_mode),
      'sounds_enabled',      coalesce(v_room.sounds_enabled, v_global.sounds_enabled)
    )
  );
end;
$$;

create or replace function public.mark_ratings_tip_seen()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  insert into public.player_preferences (player_id, has_seen_ratings_tip)
  values (v_player_id, true)
  on conflict (player_id) do update
    set has_seen_ratings_tip = true,
        updated_at = now();
end;
$$;

grant execute on function public.mark_ratings_tip_seen() to authenticated;
