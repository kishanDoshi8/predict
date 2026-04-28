-- ============================================================
-- Migration: 003_rpc_functions
-- Description: Core game logic as Postgres RPC functions.
--
-- All write operations go through these — never direct writes.
-- Player identity is global. Room membership is explicit via
-- room_members. Weekly claims are global (once per week,
-- not per room).
-- ============================================================

-- Private schema for internal helper functions.
-- Not exposed via the PostgREST API (only public schema is exposed).
create schema if not exists private;

-- ============================================================
-- HELPER: generate a random 6-char uppercase room code
-- ============================================================
create or replace function private.generate_room_code()
returns text
language plpgsql
as $$
declare
  v_code   text;
  v_exists boolean;
begin
  loop
    v_code := upper(substring(md5(random()::text) from 1 for 6));
    select count(*) > 0 into v_exists
    from public.rooms where room_code = v_code;
    exit when not v_exists;
  end loop;
  return v_code;
end;
$$;

-- ============================================================
-- HELPER: generate a secure random 64-char hex token
-- ============================================================
create or replace function private.generate_token()
returns text
language sql
as $$
  select encode(gen_random_bytes(32), 'hex');
$$;

-- ============================================================
-- HELPER: current ISO week key e.g. '2025-W04'
-- ============================================================
create or replace function private.current_week_key()
returns text
language sql
as $$
  select to_char(now() at time zone 'UTC', 'IYYY"-W"IW');
$$;

-- ============================================================
-- RPC: register_player
-- Creates a new global player account.
-- Called once when a person first uses the app.
-- Subsequent room joins use join_room with their player_token.
-- ============================================================
create or replace function public.register_player(
  p_username text
)
returns json
language plpgsql
security definer
as $$
declare
  v_player       public.players%rowtype;
  v_player_token text;
begin
  if length(trim(p_username)) < 2 then
    raise exception 'Username must be at least 2 characters' using errcode = 'P0001';
  end if;

  -- Check username not already taken globally
  if exists (
    select 1 from public.players
    where lower(username) = lower(trim(p_username))
  ) then
    raise exception 'Username is already taken' using errcode = 'P0003';
  end if;

  v_player_token := private.generate_token();

  insert into public.players (username, player_token)
  values (trim(p_username), v_player_token)
  returning * into v_player;

  return json_build_object(
    'player_id',    v_player.id,
    'username',     v_player.username,
    'player_token', v_player_token
  );
end;
$$;

-- ============================================================
-- RPC: create_room
-- Creates a room and adds the calling player as organizer.
-- Requires an existing player_token (player must be registered).
-- ============================================================
create or replace function public.create_room(
  p_player_token text,
  p_room_name    text
)
returns json
language plpgsql
security definer
as $$
declare
  v_player        public.players%rowtype;
  v_room          public.rooms%rowtype;
  v_org_token     text;
begin
  -- Resolve caller
  select * into v_player
  from public.players where player_token = p_player_token;

  if not found then
    raise exception 'Invalid player token' using errcode = 'P0004';
  end if;

  if length(trim(p_room_name)) = 0 then
    raise exception 'Room name cannot be empty' using errcode = 'P0001';
  end if;

  v_org_token := private.generate_token();

  insert into public.rooms (name, room_code, organizer_token)
  values (trim(p_room_name), private.generate_room_code(), v_org_token)
  returning * into v_room;

  -- Add player as organizer member
  insert into public.room_members (room_id, player_id, is_organizer)
  values (v_room.id, v_player.id, true);

  return json_build_object(
    'room_id',         v_room.id,
    'room_code',       v_room.room_code,
    'room_name',       v_room.name,
    'organizer_token', v_org_token,
    'player_id',       v_player.id,
    'username',        v_player.username
  );
end;
$$;

-- ============================================================
-- RPC: join_room
-- Adds an existing global player to a room.
-- Idempotent — safe to call again if player already joined.
-- ============================================================
create or replace function public.join_room(
  p_player_token text,
  p_room_code    text
)
returns json
language plpgsql
security definer
as $$
declare
  v_player  public.players%rowtype;
  v_room    public.rooms%rowtype;
  v_member  public.room_members%rowtype;
begin
  -- Resolve player
  select * into v_player
  from public.players where player_token = p_player_token;

  if not found then
    raise exception 'Invalid player token' using errcode = 'P0004';
  end if;

  -- Find room
  select * into v_room
  from public.rooms
  where room_code = upper(trim(p_room_code))
    and status = 'active';

  if not found then
    raise exception 'Room not found or closed' using errcode = 'P0002';
  end if;

  -- Insert membership (ignore if already a member)
  insert into public.room_members (room_id, player_id, is_organizer)
  values (v_room.id, v_player.id, false)
  on conflict (room_id, player_id) do nothing;

  -- Return current membership state
  select * into v_member
  from public.room_members
  where room_id = v_room.id and player_id = v_player.id;

  return json_build_object(
    'room_id',       v_room.id,
    'room_code',     v_room.room_code,
    'room_name',     v_room.name,
    'player_id',     v_player.id,
    'username',      v_player.username,
    'is_organizer',  v_member.is_organizer,
    'already_member', true  -- always safe, idempotent
  );
end;
$$;

-- ============================================================
-- RPC: claim_weekly_points
-- Awards +100 to the global wallet once per ISO week.
-- Updates global streak. Idempotent — safe on every app open.
-- ============================================================
create or replace function public.claim_weekly_points(
  p_player_token text,
  p_auto_claimed boolean default false
)
returns json
language plpgsql
security definer
as $$
declare
  v_player          public.players%rowtype;
  v_week_key        text;
  v_prev_week_key   text;
  v_new_streak      integer;
  v_already_claimed boolean;
begin
  select * into v_player
  from public.players where player_token = p_player_token;

  if not found then
    raise exception 'Invalid player token' using errcode = 'P0004';
  end if;

  v_week_key := private.current_week_key();

  -- Check if already claimed this week
  select exists (
    select 1 from public.weekly_claims
    where player_id = v_player.id
      and week_key  = v_week_key
  ) into v_already_claimed;

  if v_already_claimed then
    return json_build_object(
      'claimed',         false,
      'already_claimed', true,
      'week_key',        v_week_key,
      'points_balance',  v_player.points_balance,
      'current_streak',  v_player.current_streak
    );
  end if;

  -- Compute streak: check if last claim was exactly the previous ISO week
  v_prev_week_key := to_char(
    (now() - interval '7 days') at time zone 'UTC',
    'IYYY"-W"IW'
  );

  if v_player.last_claim_at is not null
     and to_char(v_player.last_claim_at at time zone 'UTC', 'IYYY"-W"IW') = v_prev_week_key
  then
    v_new_streak := v_player.current_streak + 1;  -- consecutive week
  else
    v_new_streak := 1;                             -- first claim or streak broken
  end if;

  -- Record the claim (no room_id — global)
  insert into public.weekly_claims (player_id, week_key, auto_claimed)
  values (v_player.id, v_week_key, p_auto_claimed);

  -- Credit points and update streak on global player record
  update public.players
  set
    points_balance = points_balance + 100,
    current_streak = v_new_streak,
    longest_streak = greatest(longest_streak, v_new_streak),
    last_claim_at  = now()
  where id = v_player.id
  returning * into v_player;

  return json_build_object(
    'claimed',         true,
    'already_claimed', false,
    'week_key',        v_week_key,
    'points_added',    100,
    'points_balance',  v_player.points_balance,
    'current_streak',  v_player.current_streak,
    'longest_streak',  v_player.longest_streak,
    'auto_claimed',    p_auto_claimed
  );
end;
$$;

-- ============================================================
-- RPC: create_prediction
-- Organizer creates a new prediction with 2–6 options.
-- Verifies organizer_token and room membership.
-- ============================================================
create or replace function public.create_prediction(
  p_organizer_token text,
  p_title           text,
  p_options         text[],
  p_deadline        timestamptz
)
returns json
language plpgsql
security definer
as $$
declare
  v_room          public.rooms%rowtype;
  v_organizer     public.players%rowtype;
  v_prediction    public.predictions%rowtype;
  v_option        public.prediction_options%rowtype;
  v_option_ids    uuid[] := '{}';
  v_label         text;
  v_i             int;
  v_active_count  int;
begin
  -- Resolve room via organizer token
  select * into v_room
  from public.rooms
  where organizer_token = p_organizer_token and status = 'active';

  if not found then
    raise exception 'Invalid organizer token or room is closed' using errcode = 'P0004';
  end if;

  -- Resolve organizer player via the room_members flag
  select p.* into v_organizer
  from public.players p
  join public.room_members rm on rm.player_id = p.id
  where rm.room_id = v_room.id and rm.is_organizer = true;

  -- Validate: no active prediction already running
  select count(*) into v_active_count
  from public.predictions
  where room_id = v_room.id
    and status in ('draft', 'locked');

  if v_active_count > 0 then
    raise exception 'A prediction is already active. Resolve or cancel it first.' using errcode = 'P0005';
  end if;

  -- Validate options count
  if array_length(p_options, 1) < 2 or array_length(p_options, 1) > 6 then
    raise exception 'Predictions must have between 2 and 6 options' using errcode = 'P0001';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Prediction title cannot be empty' using errcode = 'P0001';
  end if;

  if p_deadline <= now() then
    raise exception 'Deadline must be in the future' using errcode = 'P0001';
  end if;

  -- Create prediction
  insert into public.predictions (room_id, created_by, title, deadline)
  values (v_room.id, v_organizer.id, trim(p_title), p_deadline)
  returning * into v_prediction;

  -- Create options
  v_i := 1;
  foreach v_label in array p_options loop
    if length(trim(v_label)) = 0 then
      raise exception 'Option labels cannot be empty' using errcode = 'P0001';
    end if;

    insert into public.prediction_options (prediction_id, label, display_order)
    values (v_prediction.id, trim(v_label), v_i - 1)
    returning * into v_option;

    v_option_ids := v_option_ids || v_option.id;
    v_i := v_i + 1;
  end loop;

  return json_build_object(
    'prediction_id', v_prediction.id,
    'title',         v_prediction.title,
    'status',        v_prediction.status,
    'deadline',      v_prediction.deadline,
    'option_ids',    v_option_ids
  );
end;
$$;

-- ============================================================
-- RPC: place_bet
-- Global player bets on a prediction in a room they've joined.
-- Validates room membership before allowing any action.
-- ============================================================
create or replace function public.place_bet(
  p_player_token  text,
  p_prediction_id uuid,
  p_option_id     uuid,
  p_amount        integer
)
returns json
language plpgsql
security definer
as $$
declare
  v_player        public.players%rowtype;
  v_prediction    public.predictions%rowtype;
  v_option        public.prediction_options%rowtype;
  v_existing_bet  public.bets%rowtype;
  v_is_member     boolean;
  v_available     integer;
  v_old_amount    integer := 0;
  v_escrow_delta  integer;
begin
  -- Resolve player
  select * into v_player
  from public.players where player_token = p_player_token;

  if not found then
    raise exception 'Invalid player token' using errcode = 'P0004';
  end if;

  -- Validate prediction is in draft
  select * into v_prediction
  from public.predictions
  where id = p_prediction_id and status = 'draft';

  if not found then
    raise exception 'Prediction not found or not in draft phase' using errcode = 'P0006';
  end if;

  -- Verify player is a member of the room this prediction belongs to
  select exists (
    select 1 from public.room_members
    where room_id = v_prediction.room_id and player_id = v_player.id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  -- Deadline check
  if v_prediction.deadline <= now() then
    raise exception 'Betting deadline has passed' using errcode = 'P0007';
  end if;

  -- Validate option belongs to this prediction
  select * into v_option
  from public.prediction_options
  where id = p_option_id and prediction_id = p_prediction_id;

  if not found then
    raise exception 'Option does not belong to this prediction' using errcode = 'P0008';
  end if;

  if p_amount < 1 then
    raise exception 'Minimum bet is 1 point' using errcode = 'P0001';
  end if;

  -- Check for an existing bet (update path)
  select * into v_existing_bet
  from public.bets
  where prediction_id = p_prediction_id and player_id = v_player.id;

  if found then
    v_old_amount := v_existing_bet.amount;
  end if;

  -- Available = global balance minus all escrow, plus the old bet being replaced
  v_available := v_player.points_balance - v_player.points_in_escrow + v_old_amount;

  if p_amount > v_available then
    raise exception 'Insufficient points. Available: %, Requested: %', v_available, p_amount
    using errcode = 'P0009';
  end if;

  v_escrow_delta := p_amount - v_old_amount;

  if found then
    -- Deduct old amount from previous option's cached total
    update public.prediction_options
    set total_bet = total_bet - v_old_amount
    where id = v_existing_bet.option_id;

    -- Update bet record
    update public.bets
    set option_id  = p_option_id,
        amount     = p_amount,
        updated_at = now()
    where id = v_existing_bet.id;
  else
    insert into public.bets (prediction_id, player_id, option_id, amount)
    values (p_prediction_id, v_player.id, p_option_id, p_amount);
  end if;

  -- Update new option's cached total
  update public.prediction_options
  set total_bet = total_bet + p_amount
  where id = p_option_id;

  -- Update global escrow
  update public.players
  set points_in_escrow = points_in_escrow + v_escrow_delta
  where id = v_player.id
  returning * into v_player;

  return json_build_object(
    'bet_placed',       true,
    'prediction_id',    p_prediction_id,
    'option_id',        p_option_id,
    'amount',           p_amount,
    'points_available', v_player.points_balance - v_player.points_in_escrow
  );
end;
$$;

-- ============================================================
-- RPC: cancel_bet
-- Player cancels their own bet during draft phase.
-- ============================================================
create or replace function public.cancel_bet(
  p_player_token  text,
  p_prediction_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_player     public.players%rowtype;
  v_prediction public.predictions%rowtype;
  v_bet        public.bets%rowtype;
  v_is_member  boolean;
begin
  select * into v_player
  from public.players where player_token = p_player_token;

  if not found then
    raise exception 'Invalid player token' using errcode = 'P0004';
  end if;

  select * into v_prediction
  from public.predictions
  where id = p_prediction_id and status = 'draft';

  if not found then
    raise exception 'Prediction not found or not in draft phase' using errcode = 'P0006';
  end if;

  -- Verify membership
  select exists (
    select 1 from public.room_members
    where room_id = v_prediction.room_id and player_id = v_player.id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  select * into v_bet
  from public.bets
  where prediction_id = p_prediction_id and player_id = v_player.id;

  if not found then
    raise exception 'No bet found to cancel' using errcode = 'P0010';
  end if;

  -- Remove from option cached total
  update public.prediction_options
  set total_bet = total_bet - v_bet.amount
  where id = v_bet.option_id;

  -- Release global escrow
  update public.players
  set points_in_escrow = points_in_escrow - v_bet.amount
  where id = v_player.id;

  delete from public.bets where id = v_bet.id;

  return json_build_object(
    'cancelled',    true,
    'points_freed', v_bet.amount
  );
end;
$$;

-- ============================================================
-- RPC: lock_prediction
-- Organizer manually locks a prediction before the deadline.
-- ============================================================
create or replace function public.lock_prediction(
  p_organizer_token text,
  p_prediction_id   uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_room       public.rooms%rowtype;
  v_prediction public.predictions%rowtype;
begin
  select * into v_room
  from public.rooms
  where organizer_token = p_organizer_token and status = 'active';

  if not found then
    raise exception 'Invalid organizer token' using errcode = 'P0004';
  end if;

  select * into v_prediction
  from public.predictions
  where id = p_prediction_id
    and room_id = v_room.id
    and status = 'draft';

  if not found then
    raise exception 'Prediction not found or not in draft phase' using errcode = 'P0006';
  end if;

  update public.predictions
  set status = 'locked'
  where id = v_prediction.id
  returning * into v_prediction;

  return json_build_object(
    'locked',        true,
    'prediction_id', v_prediction.id
  );
end;
$$;
