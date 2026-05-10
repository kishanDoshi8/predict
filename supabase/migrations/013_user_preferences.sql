-- ============================================================
-- Migration: 013_user_preferences
-- Description:
--   Global + per-room user preferences for notifications and UI
-- ============================================================

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.player_preferences (
  player_id             uuid primary key references public.players(id) on delete cascade,
  prediction_live       boolean not null default true,
  prediction_locked     boolean not null default true,
  deadline_1h           boolean not null default true,
  result_revealed       boolean not null default true,
  weekly_points_claim   boolean not null default true,
  dark_mode             boolean not null default true,
  sounds_enabled        boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Product decision: dark theme only for now.
  check (dark_mode = true)
);

comment on table public.player_preferences is
'Global defaults for player preferences. One row per player.';

create table if not exists public.room_preferences (
  id                    uuid primary key default gen_random_uuid(),
  room_id               uuid not null references public.rooms(id) on delete cascade,
  player_id             uuid not null references public.players(id) on delete cascade,
  prediction_live       boolean,
  prediction_locked     boolean,
  deadline_1h           boolean,
  result_revealed       boolean,
  weekly_points_claim   boolean,
  dark_mode             boolean,
  sounds_enabled        boolean,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (room_id, player_id),
  -- Product decision: room override may inherit (null) or force dark (true).
  check (dark_mode is null or dark_mode = true)
);

comment on table public.room_preferences is
'Per-room preference overrides. Null means inherit from global default.';

create index if not exists idx_room_preferences_room_player
  on public.room_preferences(room_id, player_id);

create index if not exists idx_room_preferences_player
  on public.room_preferences(player_id);

-- Seed defaults for existing players
insert into public.player_preferences (player_id)
select p.id
from public.players p
on conflict (player_id) do nothing;


-- ============================================================
-- HELPERS
-- ============================================================

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_player_preferences_touch_updated_at
before update on public.player_preferences
for each row execute function private.touch_updated_at();

create trigger trg_room_preferences_touch_updated_at
before update on public.room_preferences
for each row execute function private.touch_updated_at();

create or replace function private.create_default_player_preferences()
returns trigger
language plpgsql
as $$
begin
  insert into public.player_preferences (player_id)
  values (new.id)
  on conflict (player_id) do nothing;

  return new;
end;
$$;

create trigger trg_players_create_default_preferences
after insert on public.players
for each row execute function private.create_default_player_preferences();


-- ============================================================
-- RLS + PRIVILEGES
-- ============================================================

alter table public.player_preferences enable row level security;
alter table public.room_preferences enable row level security;

revoke all on public.player_preferences from anon;
revoke all on public.room_preferences from anon;

create policy "player_preferences_no_direct_select"
  on public.player_preferences
  for select
  using (false);

create policy "player_preferences_no_direct_insert"
  on public.player_preferences
  for insert
  with check (false);

create policy "player_preferences_no_direct_update"
  on public.player_preferences
  for update
  using (false);

create policy "player_preferences_no_direct_delete"
  on public.player_preferences
  for delete
  using (false);

create policy "room_preferences_no_direct_select"
  on public.room_preferences
  for select
  using (false);

create policy "room_preferences_no_direct_insert"
  on public.room_preferences
  for insert
  with check (false);

create policy "room_preferences_no_direct_update"
  on public.room_preferences
  for update
  using (false);

create policy "room_preferences_no_direct_delete"
  on public.room_preferences
  for delete
  using (false);


-- ============================================================
-- RPC: get_preferences
-- ============================================================

create or replace function public.get_preferences(
  p_player_token text,
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
  v_global public.player_preferences%rowtype;
  v_room public.room_preferences%rowtype;
begin
  select id into v_player_id
  from public.players
  where player_token = p_player_token;

  if v_player_id is null then
    raise exception 'Invalid player token' using errcode = 'P0004';
  end if;

  if p_room_id is not null then
    select exists (
      select 1
      from public.room_members
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
    'global', json_build_object(
      'prediction_live', v_global.prediction_live,
      'prediction_locked', v_global.prediction_locked,
      'deadline_1h', v_global.deadline_1h,
      'result_revealed', v_global.result_revealed,
      'weekly_points_claim', v_global.weekly_points_claim,
      'dark_mode', v_global.dark_mode,
      'sounds_enabled', v_global.sounds_enabled
    ),
    'room_overrides', json_build_object(
      'prediction_live', case when v_room.id is null then null else v_room.prediction_live end,
      'prediction_locked', case when v_room.id is null then null else v_room.prediction_locked end,
      'deadline_1h', case when v_room.id is null then null else v_room.deadline_1h end,
      'result_revealed', case when v_room.id is null then null else v_room.result_revealed end,
      'weekly_points_claim', case when v_room.id is null then null else v_room.weekly_points_claim end,
      'dark_mode', case when v_room.id is null then null else v_room.dark_mode end,
      'sounds_enabled', case when v_room.id is null then null else v_room.sounds_enabled end
    ),
    'effective', json_build_object(
      'prediction_live', coalesce(v_room.prediction_live, v_global.prediction_live),
      'prediction_locked', coalesce(v_room.prediction_locked, v_global.prediction_locked),
      'deadline_1h', coalesce(v_room.deadline_1h, v_global.deadline_1h),
      'result_revealed', coalesce(v_room.result_revealed, v_global.result_revealed),
      'weekly_points_claim', coalesce(v_room.weekly_points_claim, v_global.weekly_points_claim),
      'dark_mode', coalesce(v_room.dark_mode, v_global.dark_mode),
      'sounds_enabled', coalesce(v_room.sounds_enabled, v_global.sounds_enabled)
    )
  );
end;
$$;


-- ============================================================
-- RPC: update_global_preferences
-- ============================================================

create or replace function public.update_global_preferences(
  p_player_token text,
  p_prediction_live boolean,
  p_prediction_locked boolean,
  p_deadline_1h boolean,
  p_result_revealed boolean,
  p_weekly_points_claim boolean,
  p_dark_mode boolean,
  p_sounds_enabled boolean
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

  select id into v_player_id
  from public.players
  where player_token = p_player_token;

  if v_player_id is null then
    raise exception 'Invalid player token' using errcode = 'P0004';
  end if;

  insert into public.player_preferences (
    player_id,
    prediction_live,
    prediction_locked,
    deadline_1h,
    result_revealed,
    weekly_points_claim,
    dark_mode,
    sounds_enabled
  )
  values (
    v_player_id,
    p_prediction_live,
    p_prediction_locked,
    p_deadline_1h,
    p_result_revealed,
    p_weekly_points_claim,
    p_dark_mode,
    p_sounds_enabled
  )
  on conflict (player_id) do update
  set
    prediction_live = excluded.prediction_live,
    prediction_locked = excluded.prediction_locked,
    deadline_1h = excluded.deadline_1h,
    result_revealed = excluded.result_revealed,
    weekly_points_claim = excluded.weekly_points_claim,
    dark_mode = excluded.dark_mode,
    sounds_enabled = excluded.sounds_enabled,
    updated_at = now();

  return public.get_preferences(p_player_token, null);
end;
$$;


-- ============================================================
-- RPC: update_room_preferences
-- ============================================================

create or replace function public.update_room_preferences(
  p_player_token text,
  p_room_id uuid,
  p_prediction_live boolean default null,
  p_prediction_locked boolean default null,
  p_deadline_1h boolean default null,
  p_result_revealed boolean default null,
  p_weekly_points_claim boolean default null,
  p_dark_mode boolean default null,
  p_sounds_enabled boolean default null
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

  select id into v_player_id
  from public.players
  where player_token = p_player_token;

  if v_player_id is null then
    raise exception 'Invalid player token' using errcode = 'P0004';
  end if;

  select exists (
    select 1
    from public.room_members
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

    return public.get_preferences(p_player_token, p_room_id);
  end if;

  insert into public.room_preferences (
    room_id,
    player_id,
    prediction_live,
    prediction_locked,
    deadline_1h,
    result_revealed,
    weekly_points_claim,
    dark_mode,
    sounds_enabled
  )
  values (
    p_room_id,
    v_player_id,
    p_prediction_live,
    p_prediction_locked,
    p_deadline_1h,
    p_result_revealed,
    p_weekly_points_claim,
    p_dark_mode,
    p_sounds_enabled
  )
  on conflict (room_id, player_id) do update
  set
    prediction_live = excluded.prediction_live,
    prediction_locked = excluded.prediction_locked,
    deadline_1h = excluded.deadline_1h,
    result_revealed = excluded.result_revealed,
    weekly_points_claim = excluded.weekly_points_claim,
    dark_mode = excluded.dark_mode,
    sounds_enabled = excluded.sounds_enabled,
    updated_at = now();

  return public.get_preferences(p_player_token, p_room_id);
end;
$$;


-- ============================================================
-- RPC: reset_room_preferences
-- ============================================================

create or replace function public.reset_room_preferences(
  p_player_token text,
  p_room_id uuid
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
  select id into v_player_id
  from public.players
  where player_token = p_player_token;

  if v_player_id is null then
    raise exception 'Invalid player token' using errcode = 'P0004';
  end if;

  select exists (
    select 1
    from public.room_members
    where room_id = p_room_id and player_id = v_player_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'Access denied: you are not a member of this room' using errcode = 'P0011';
  end if;

  delete from public.room_preferences
  where room_id = p_room_id and player_id = v_player_id;

  return public.get_preferences(p_player_token, p_room_id);
end;
$$;
