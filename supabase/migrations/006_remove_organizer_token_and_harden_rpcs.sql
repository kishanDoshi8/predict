-- ============================================================
-- Migration: 006_remove_organizer_token_and_harden_rpcs
-- Description:
-- 1. Remove organizer_token from public.rooms
-- 2. Update table comments
-- 3. Refactor organizer-based RPCs to use room_members.is_organizer
-- 4. Add explicit search_path to all public RPCs
-- ============================================================

-- ============================================================
-- 1. DROP organizer_token
-- ============================================================

alter table public.rooms
  drop column if exists organizer_token;

comment on table public.rooms is
'Private prediction rooms. Joined via room_code. Organizer is defined via public.room_members.is_organizer.';


-- ============================================================
-- 2. RECREATE ORGANIZER RPCs (token → player_token based)
-- ============================================================

-- ============================================================
-- RPC: create_prediction (UPDATED)
-- ============================================================
drop function if exists public.create_prediction(text, text, text[], timestamptz);

create function public.create_prediction(
  p_player_token text,
  p_room_id      uuid,
  p_title        text,
  p_options      text[],
  p_deadline     timestamptz
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player        public.players%rowtype;
  v_member        public.room_members%rowtype;
  v_prediction    public.predictions%rowtype;
  v_option        public.prediction_options%rowtype;
  v_option_ids    uuid[] := '{}';
  v_label         text;
  v_i             int;
  v_active_count  int;
begin
  -- Resolve player
  select * into v_player
  from public.players
  where player_token = p_player_token;

  if not found then
    raise exception 'Invalid player token' using errcode = 'P0004';
  end if;

  -- Verify organizer membership
  select * into v_member
  from public.room_members
  where room_id = p_room_id
    and player_id = v_player.id
    and is_organizer = true;

  if not found then
    raise exception 'Only the organizer can create predictions'
    using errcode = 'P0012';
  end if;

  -- Prevent multiple active predictions
  select count(*) into v_active_count
  from public.predictions
  where room_id = p_room_id
    and status in ('draft','locked');

  if v_active_count > 0 then
    raise exception 'A prediction is already active.'
    using errcode = 'P0005';
  end if;

  if array_length(p_options,1) < 2 or array_length(p_options,1) > 6 then
    raise exception 'Predictions must have between 2 and 6 options'
    using errcode = 'P0001';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Prediction title cannot be empty'
    using errcode = 'P0001';
  end if;

  if p_deadline <= now() then
    raise exception 'Deadline must be in the future'
    using errcode = 'P0001';
  end if;

  insert into public.predictions (room_id, created_by, title, deadline)
  values (p_room_id, v_player.id, trim(p_title), p_deadline)
  returning * into v_prediction;

  v_i := 1;

  foreach v_label in array p_options loop
    if length(trim(v_label)) = 0 then
      raise exception 'Option labels cannot be empty'
      using errcode = 'P0001';
    end if;

    insert into public.prediction_options (prediction_id,label,display_order)
    values (v_prediction.id, trim(v_label), v_i - 1)
    returning * into v_option;

    v_option_ids := v_option_ids || v_option.id;
    v_i := v_i + 1;
  end loop;

  return json_build_object(
    'prediction_id', v_prediction.id,
    'title', v_prediction.title,
    'status', v_prediction.status,
    'deadline', v_prediction.deadline,
    'option_ids', v_option_ids
  );
end;
$$;



-- ============================================================
-- RPC: lock_prediction (UPDATED)
-- ============================================================
drop function if exists public.lock_prediction(text, uuid);

create function public.lock_prediction(
  p_player_token  text,
  p_prediction_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player        public.players%rowtype;
  v_prediction    public.predictions%rowtype;
  v_member        public.room_members%rowtype;
begin
  -- Resolve player
  select * into v_player
  from public.players
  where player_token = p_player_token;

  if not found then
    raise exception 'Invalid player token'
    using errcode = 'P0004';
  end if;

  -- Resolve prediction
  select * into v_prediction
  from public.predictions
  where id = p_prediction_id
    and status = 'draft';

  if not found then
    raise exception 'Prediction not found or not in draft phase'
    using errcode = 'P0006';
  end if;

  -- Verify organizer
  select * into v_member
  from public.room_members
  where room_id = v_prediction.room_id
    and player_id = v_player.id
    and is_organizer = true;

  if not found then
    raise exception 'Only the organizer can lock this prediction'
    using errcode = 'P0012';
  end if;

  update public.predictions
  set status = 'locked'
  where id = v_prediction.id
  returning * into v_prediction;

  return json_build_object(
    'locked', true,
    'prediction_id', v_prediction.id
  );
end;
$$;



-- ============================================================
-- 3. HARDEN REMAINING PUBLIC RPCs WITH search_path
-- ============================================================

alter function public.register_player(text)
  set search_path = public, private;

alter function public.create_room(text,text)
  set search_path = public, private;

alter function public.join_room(text,text)
  set search_path = public, private;

alter function public.claim_weekly_points(text,boolean)
  set search_path = public, private;

alter function public.place_bet(text,uuid,uuid,integer)
  set search_path = public, private;

alter function public.cancel_bet(text,uuid)
  set search_path = public, private;