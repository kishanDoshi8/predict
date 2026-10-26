-- ============================================================
-- Migration: weekly_recap_push
-- Description: One push per room on Monday: the weekly standings, with the
--   top-up line when top-ups were paid (only the top-up in a series' first
--   week). Every push now has a setting: "result needed" joins the app-wide
--   and per-room notification preferences.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columns
-- ------------------------------------------------------------
-- How many players last week's top-up reached, for the Monday push.
alter table public.series
  add column if not exists last_topup_recipients integer not null default 0;

-- Per-room override for the staff "result needed" push.
alter table public.room_preferences
  add column if not exists result_needed boolean;

-- ------------------------------------------------------------
-- 2. Monday: top-ups no longer push; one recap push per room
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.pay_series_topups()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_week_key   text := private.current_week_key();
  v_this_week  timestamptz := date_trunc('week', now() at time zone 'UTC') at time zone 'UTC';
  v_last_week  timestamptz := v_this_week - interval '7 days';
  v_series     record;
  v_paid       integer;
  v_count      integer := 0;
begin
  for v_series in
    select s.id, s.room_id, s.title, s.weekly_topup, r.room_code
    from public.series s
    join public.rooms r on r.id = s.room_id
    where s.status = 'active'
      and s.weekly_topup > 0
      and s.last_topup_week is distinct from v_week_key
    for update of s
  loop
    update public.series_wallets w
    set balance = w.balance + v_series.weekly_topup,
        granted = w.granted + v_series.weekly_topup,
        updated_at = now()
    where w.series_id = v_series.id
      and (
        w.balance - w.escrow <= 0
        or exists (
          select 1
          from public.bets b
          join public.predictions p on p.id = b.prediction_id
          where p.series_id = v_series.id
            and b.player_id = w.player_id
            and greatest(b.placed_at, b.updated_at) >= v_last_week
            and greatest(b.placed_at, b.updated_at) < v_this_week
        )
      );
    get diagnostics v_paid = row_count;

    -- Counts every week a top-up round ran, so late joiners start level with active players.
    update public.series
    set topups_paid = topups_paid + 1,
        last_topup_week = v_week_key,
        last_topup_recipients = v_paid
    where id = v_series.id;

    -- The Monday push goes out from private.notify_weekly_recap(), one per room.

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

-- Monday cron, last step: one push per room with an active series. From the
-- second week it's the weekly standings (with the top-up line when top-ups
-- were paid); in a series' first week it's only the top-up, if any.
create or replace function private.notify_weekly_recap()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_week_key  text := private.current_week_key();
  v_room      record;
  v_weeks     integer;
  v_leader    text;
  v_topup     text;
  v_count     integer := 0;
begin
  -- A room with several active series hears about its newest one.
  for v_room in
    select distinct on (s.room_id)
      s.id as series_id,
      s.room_id,
      s.title,
      s.weekly_topup,
      s.last_topup_week,
      s.last_topup_recipients,
      r.room_code
    from public.series s
    join public.rooms r on r.id = s.room_id
    where s.status = 'active'
    order by s.room_id, s.created_at desc
  loop
    v_topup := case
      when v_room.last_topup_week = v_week_key and v_room.last_topup_recipients > 0
        then '+' || v_room.weekly_topup || ' points for everyone who played.'
    end;

    select count(distinct week_key)::int into v_weeks
    from public.series_standing_snapshots
    where series_id = v_room.series_id and week_key <= v_week_key;

    if v_weeks >= 2 and exists (
      select 1 from public.series_standing_snapshots
      where series_id = v_room.series_id and week_key = v_week_key
    ) then
      select p.username into v_leader
      from public.series_standing_snapshots ss
      join public.players p on p.id = ss.player_id
      where ss.series_id = v_room.series_id
        and ss.week_key = v_week_key
        and ss.rank = 1
      order by p.username
      limit 1;

      perform private.fire_push_notification(
        'weekly_points_claim',
        null,
        v_room.room_id,
        'Week ' || v_weeks || ' standings are in',
        concat_ws(' ',
          coalesce(v_leader || ' leads ' || v_room.title || '.', 'Standings for ' || v_room.title || ' are in.'),
          v_topup
        ),
        '/rooms/' || v_room.room_code || '/leaderboard'
      );
      v_count := v_count + 1;
    elsif v_topup is not null then
      perform private.fire_push_notification(
        'weekly_points_claim',
        null,
        v_room.room_id,
        '+' || v_room.weekly_topup || ' points',
        'Weekly top-ups for ' || v_room.title || ' are in for everyone who played last week.',
        '/rooms/' || v_room.room_code
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function private.notify_weekly_recap() from public, anon, authenticated;

select cron.schedule(
  'series-weekly-topup',
  '5 0 * * 1',
  $$select private.snapshot_series_standings(); select private.pay_series_topups(); select private.notify_weekly_recap()$$
);

-- ------------------------------------------------------------
-- 3. "Result needed" in notification preferences
-- ------------------------------------------------------------
drop function if exists public.update_global_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean);
drop function if exists public.update_room_preferences(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION public.get_preferences(p_room_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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
      'result_needed',       v_global.result_needed,
      'dark_mode',           v_global.dark_mode,
      'sounds_enabled',      v_global.sounds_enabled
    ),
    'room_overrides', json_build_object(
      'prediction_live',     case when v_room.id is null then null else v_room.prediction_live end,
      'prediction_locked',   case when v_room.id is null then null else v_room.prediction_locked end,
      'deadline_1h',         case when v_room.id is null then null else v_room.deadline_1h end,
      'result_revealed',     case when v_room.id is null then null else v_room.result_revealed end,
      'weekly_points_claim', case when v_room.id is null then null else v_room.weekly_points_claim end,
      'result_needed',       case when v_room.id is null then null else v_room.result_needed end,
      'dark_mode',           case when v_room.id is null then null else v_room.dark_mode end,
      'sounds_enabled',      case when v_room.id is null then null else v_room.sounds_enabled end
    ),
    'effective', json_build_object(
      'prediction_live',     coalesce(v_room.prediction_live, v_global.prediction_live),
      'prediction_locked',   coalesce(v_room.prediction_locked, v_global.prediction_locked),
      'deadline_1h',         coalesce(v_room.deadline_1h, v_global.deadline_1h),
      'result_revealed',     coalesce(v_room.result_revealed, v_global.result_revealed),
      'weekly_points_claim', coalesce(v_room.weekly_points_claim, v_global.weekly_points_claim),
      'result_needed',       coalesce(v_room.result_needed, v_global.result_needed),
      'dark_mode',           coalesce(v_room.dark_mode, v_global.dark_mode),
      'sounds_enabled',      coalesce(v_room.sounds_enabled, v_global.sounds_enabled)
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_global_preferences(p_prediction_live boolean, p_prediction_locked boolean, p_deadline_1h boolean, p_result_revealed boolean, p_weekly_points_claim boolean, p_dark_mode boolean, p_sounds_enabled boolean, p_result_needed boolean DEFAULT NULL::boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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
    result_revealed, weekly_points_claim, dark_mode, sounds_enabled, result_needed
  )
  values (
    v_player_id, p_prediction_live, p_prediction_locked, p_deadline_1h,
    p_result_revealed, p_weekly_points_claim, p_dark_mode, p_sounds_enabled,
    coalesce(p_result_needed, true)
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
    -- Older clients don't send it; keep what's saved.
    result_needed       = coalesce(p_result_needed, player_preferences.result_needed),
    updated_at          = now();

  return public.get_preferences(null);
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_room_preferences(p_room_id uuid, p_prediction_live boolean DEFAULT NULL::boolean, p_prediction_locked boolean DEFAULT NULL::boolean, p_deadline_1h boolean DEFAULT NULL::boolean, p_result_revealed boolean DEFAULT NULL::boolean, p_weekly_points_claim boolean DEFAULT NULL::boolean, p_dark_mode boolean DEFAULT NULL::boolean, p_sounds_enabled boolean DEFAULT NULL::boolean, p_result_needed boolean DEFAULT NULL::boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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
    and p_result_needed is null
  then
    delete from public.room_preferences
    where room_id = p_room_id and player_id = v_player_id;
    return public.get_preferences(p_room_id);
  end if;

  insert into public.room_preferences (
    room_id, player_id, prediction_live, prediction_locked, deadline_1h,
    result_revealed, weekly_points_claim, dark_mode, sounds_enabled, result_needed
  )
  values (
    p_room_id, v_player_id, p_prediction_live, p_prediction_locked, p_deadline_1h,
    p_result_revealed, p_weekly_points_claim, p_dark_mode, p_sounds_enabled, p_result_needed
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
    result_needed       = excluded.result_needed,
    updated_at          = now();

  return public.get_preferences(p_room_id);
end;
$function$;

revoke execute on function public.update_global_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke execute on function public.update_room_preferences(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.update_global_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.update_room_preferences(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
