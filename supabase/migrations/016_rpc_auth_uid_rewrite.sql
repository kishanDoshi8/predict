-- ============================================================
-- Migration: 016_rpc_auth_uid_rewrite
-- Description:
--   Rewrite all public RPCs to use auth.uid() for player
--   identity instead of p_player_token parameters.
--   All sensitive RPCs are now gated on the authenticated
--   Supabase session; no client-passed token is accepted.
-- ============================================================

-- ============================================================
-- RPC: register_player
-- Creates or returns the player profile linked to auth.uid().
-- Called once after email/password sign-up to set a username.
-- Idempotent: returns existing profile if already registered.
-- ============================================================
drop function if exists public.register_player(text);

create or replace function public.register_player(
  p_username text
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player public.players%rowtype;
  v_uid    uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  if length(trim(p_username)) < 2 then
    raise exception 'Username must be at least 2 characters' using errcode = 'P0001';
  end if;

  -- Return existing profile if already registered
  select * into v_player
  from public.players
  where user_id = v_uid;

  if found then
    return json_build_object(
      'player_id', v_player.id,
      'username',  v_player.username
    );
  end if;

  -- Check username not already taken globally
  if exists (
    select 1 from public.players
    where lower(username) = lower(trim(p_username))
  ) then
    raise exception 'Username is already taken' using errcode = 'P0003';
  end if;

  insert into public.players (username, user_id, player_token)
  values (trim(p_username), v_uid, private.generate_token())
  returning * into v_player;

  return json_build_object(
    'player_id', v_player.id,
    'username',  v_player.username
  );
end;
$$;

grant execute on function public.register_player(text) to authenticated;


-- ============================================================
-- RPC: get_player
-- Returns the player profile for the authenticated user.
-- ============================================================
drop function if exists public.get_player(text);

create or replace function public.get_player()
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player public.players%rowtype;
begin
  select * into v_player
  from public.players
  where user_id = auth.uid();

  if not found then
    raise exception 'Player profile not found' using errcode = 'P0001';
  end if;

  return json_build_object(
    'id',               v_player.id,
    'username',         v_player.username,
    'points_in_escrow', v_player.points_in_escrow,
    'points_balance',   v_player.points_balance,
    'total_won',        v_player.total_won,
    'current_streak',   v_player.current_streak,
    'longest_streak',   v_player.longest_streak,
    'last_claim_at',    v_player.last_claim_at
  );
end;
$$;

grant execute on function public.get_player() to authenticated;


-- ============================================================
-- RPC: create_room
-- Creates a room and adds the authenticated player as organizer.
-- ============================================================
drop function if exists public.create_room(text, text);

create or replace function public.create_room(
  p_room_name text
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_room      public.rooms%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if length(trim(p_room_name)) = 0 then
    raise exception 'Room name cannot be empty' using errcode = 'P0001';
  end if;

  insert into public.rooms (name, room_code)
  values (trim(p_room_name), private.generate_room_code())
  returning * into v_room;

  insert into public.room_members (room_id, player_id, is_organizer)
  values (v_room.id, v_player_id, true);

  return json_build_object(
    'id',         v_room.id,
    'code',       v_room.room_code,
    'name',       v_room.name,
    'status',     v_room.status,
    'player_id',  v_player_id,
    'created_at', v_room.created_at
  );
end;
$$;

grant execute on function public.create_room(text) to authenticated;


-- ============================================================
-- RPC: join_room
-- Adds the authenticated player to a room (idempotent).
-- ============================================================
drop function if exists public.join_room(text, text);

create or replace function public.join_room(
  p_room_code text
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_player    public.players%rowtype;
  v_room      public.rooms%rowtype;
  v_member    public.room_members%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select * into v_player from public.players where id = v_player_id;

  select * into v_room
  from public.rooms
  where room_code = upper(trim(p_room_code))
    and status = 'active';

  if not found then
    raise exception 'Room not found or closed' using errcode = 'P0002';
  end if;

  insert into public.room_members (room_id, player_id, is_organizer)
  values (v_room.id, v_player_id, false)
  on conflict (room_id, player_id) do nothing;

  select * into v_member
  from public.room_members
  where room_id = v_room.id and player_id = v_player_id;

  return json_build_object(
    'id',           v_room.id,
    'code',         v_room.room_code,
    'name',         v_room.name,
    'status',       v_room.status,
    'player_id',    v_player_id,
    'username',     v_player.username,
    'is_organizer', v_member.is_organizer,
    'created_at',   v_room.created_at
  );
end;
$$;

grant execute on function public.join_room(text) to authenticated;


-- ============================================================
-- RPC: claim_weekly_points
-- Awards +100 to the global wallet once per ISO week.
-- ============================================================
drop function if exists public.claim_weekly_points(text, boolean);

create or replace function public.claim_weekly_points(
  p_auto_claimed boolean default false
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player          public.players%rowtype;
  v_week_key        text;
  v_prev_week_key   text;
  v_new_streak      integer;
  v_already_claimed boolean;
begin
  select * into v_player
  from public.players
  where user_id = auth.uid();

  if not found then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  v_week_key := private.current_week_key();

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

  v_prev_week_key := to_char(
    (now() - interval '7 days') at time zone 'UTC',
    'IYYY"-W"IW'
  );

  if v_player.last_claim_at is not null
     and to_char(v_player.last_claim_at at time zone 'UTC', 'IYYY"-W"IW') = v_prev_week_key
  then
    v_new_streak := v_player.current_streak + 1;
  else
    v_new_streak := 1;
  end if;

  insert into public.weekly_claims (player_id, week_key, auto_claimed)
  values (v_player.id, v_week_key, p_auto_claimed);

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

grant execute on function public.claim_weekly_points(boolean) to authenticated;


-- ============================================================
-- RPC: create_prediction
-- Organizer creates a prediction with 2–6 options.
-- ============================================================
drop function if exists public.create_prediction(text, uuid, text, text[], timestamptz);

create or replace function public.create_prediction(
  p_room_id  uuid,
  p_title    text,
  p_options  text[],
  p_deadline timestamptz
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id     uuid;
  v_member        public.room_members%rowtype;
  v_prediction    public.predictions%rowtype;
  v_option        public.prediction_options%rowtype;
  v_option_ids    uuid[] := '{}';
  v_label         text;
  v_i             int;
  v_active_count  int;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select * into v_member
  from public.room_members
  where room_id = p_room_id
    and player_id = v_player_id
    and is_organizer = true;

  if not found then
    raise exception 'Only the organizer can create predictions' using errcode = 'P0012';
  end if;

  select count(*) into v_active_count
  from public.predictions
  where room_id = p_room_id
    and status in ('draft', 'locked');

  if v_active_count > 0 then
    raise exception 'A prediction is already active.' using errcode = 'P0005';
  end if;

  if array_length(p_options, 1) < 2 or array_length(p_options, 1) > 6 then
    raise exception 'Predictions must have between 2 and 6 options' using errcode = 'P0001';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Prediction title cannot be empty' using errcode = 'P0001';
  end if;

  if p_deadline <= now() then
    raise exception 'Deadline must be in the future' using errcode = 'P0001';
  end if;

  insert into public.predictions (room_id, created_by, title, deadline)
  values (p_room_id, v_player_id, trim(p_title), p_deadline)
  returning * into v_prediction;

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

grant execute on function public.create_prediction(uuid, text, text[], timestamptz) to authenticated;


-- ============================================================
-- RPC: lock_prediction
-- Organizer manually locks a prediction before the deadline.
-- ============================================================
drop function if exists public.lock_prediction(text, uuid);

create or replace function public.lock_prediction(
  p_prediction_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id  uuid;
  v_prediction public.predictions%rowtype;
  v_member     public.room_members%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select * into v_prediction
  from public.predictions
  where id = p_prediction_id
    and status = 'draft';

  if not found then
    raise exception 'Prediction not found or not in draft phase' using errcode = 'P0006';
  end if;

  select * into v_member
  from public.room_members
  where room_id = v_prediction.room_id
    and player_id = v_player_id
    and is_organizer = true;

  if not found then
    raise exception 'Only the organizer can lock this prediction' using errcode = 'P0012';
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

grant execute on function public.lock_prediction(uuid) to authenticated;


-- ============================================================
-- RPC: resolve_prediction_v2
-- Organizer resolves a locked prediction.
-- ============================================================
drop function if exists public.resolve_prediction_v2(text, uuid, uuid, text, uuid);
drop function if exists public.resolve_prediction_v2(uuid, uuid, uuid, text, uuid);

create or replace function public.resolve_prediction_v2(
  p_prediction_id     uuid,
  p_room_id           uuid,
  p_outcome           text,
  p_winning_option_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id         uuid;
  v_prediction        public.predictions%rowtype;
  v_winning_option    public.prediction_options%rowtype;

  v_total_winner_cap  numeric;
  v_loser             record;
  v_winner            record;
  v_winner_gain       integer;
  v_loser_refund      integer;
  v_final_payout      integer;
  v_winners_count     integer := 0;
  v_losers_count      integer := 0;
  v_multiple_sides    boolean;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  -- Verify organizer
  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and player_id = v_player_id
      and is_organizer = true
  ) then
    raise exception 'Only the room organizer can resolve predictions' using errcode = 'P0012';
  end if;

  select * into v_prediction
  from public.predictions
  where id      = p_prediction_id
    and room_id = p_room_id
    and status  = 'locked';

  if not found then
    raise exception 'Prediction not found or not in locked phase' using errcode = 'P0006';
  end if;

  -- CANCEL / NO RESULT — full refund
  if p_outcome in ('no_result', 'cancel') then
    perform private.refund_all_bets_v2(p_prediction_id);

    update public.predictions
    set status      = p_outcome,
        resolved_at = now()
    where id = p_prediction_id;

    return json_build_object(
      'resolved', true,
      'outcome',  p_outcome,
      'refunded', true
    );
  end if;

  -- WIN
  if p_outcome <> 'win' then
    raise exception 'Invalid outcome. Must be win, no_result, or cancel.' using errcode = 'P0001';
  end if;

  if p_winning_option_id is null then
    raise exception 'p_winning_option_id is required for a win outcome' using errcode = 'P0001';
  end if;

  select * into v_winning_option
  from public.prediction_options
  where id            = p_winning_option_id
    and prediction_id = p_prediction_id;

  if not found then
    raise exception 'Winning option does not belong to this prediction' using errcode = 'P0008';
  end if;

  -- Edge: only one option received bets → no_result
  select count(distinct option_id) > 1 into v_multiple_sides
  from public.bets
  where prediction_id = p_prediction_id;

  if not v_multiple_sides then
    perform private.refund_all_bets_v2(p_prediction_id);
    update public.predictions set status = 'no_result', resolved_at = now()
    where id = p_prediction_id;
    return json_build_object(
      'resolved', true, 'outcome', 'no_result',
      'reason', 'Only one option had bets — all refunded', 'refunded', true
    );
  end if;

  -- Edge: nobody bet on winning option → no_result
  if v_winning_option.total_bet = 0 then
    perform private.refund_all_bets_v2(p_prediction_id);
    update public.predictions set status = 'no_result', resolved_at = now()
    where id = p_prediction_id;
    return json_build_object(
      'resolved', true, 'outcome', 'no_result',
      'reason', 'Nobody bet on the winning option — all refunded', 'refunded', true
    );
  end if;

  -- PER-LOSER INDEPENDENT MATCHING
  select sum(amount)::numeric into v_total_winner_cap
  from public.bets
  where prediction_id = p_prediction_id
    and option_id     = p_winning_option_id;

  create temp table _winner_gains (
    player_id  uuid    primary key,
    bet_amount integer not null,
    total_gain integer not null default 0
  ) on commit drop;

  insert into _winner_gains (player_id, bet_amount)
  select player_id, amount
  from public.bets
  where prediction_id = p_prediction_id
    and option_id     = p_winning_option_id;

  for v_loser in
    select b.id as bet_id, b.player_id, b.amount
    from public.bets b
    where b.prediction_id = p_prediction_id
      and b.option_id    <> p_winning_option_id
  loop
    if v_loser.amount::numeric >= v_total_winner_cap then
      v_loser_refund := v_loser.amount - v_total_winner_cap::integer;
      for v_winner in select player_id, bet_amount from _winner_gains loop
        update _winner_gains
        set total_gain = total_gain + v_winner.bet_amount
        where player_id = v_winner.player_id;
      end loop;
    else
      v_loser_refund := 0;
      for v_winner in select player_id, bet_amount from _winner_gains loop
        v_winner_gain := floor(
          (v_winner.bet_amount::numeric / v_total_winner_cap) * v_loser.amount::numeric
        );
        update _winner_gains
        set total_gain = total_gain + v_winner_gain
        where player_id = v_winner.player_id;
      end loop;
    end if;

    update public.players
    set points_in_escrow = points_in_escrow - v_loser.amount,
        points_balance   = points_balance   - v_loser.amount + v_loser_refund
    where id = v_loser.player_id;

    update public.bets
    set payout = v_loser_refund
    where id = v_loser.bet_id;

    v_losers_count := v_losers_count + 1;
  end loop;

  for v_winner in select player_id, bet_amount, total_gain from _winner_gains loop
    v_final_payout := v_winner.bet_amount + v_winner.total_gain;

    update public.players
    set points_in_escrow = points_in_escrow - v_winner.bet_amount,
        points_balance   = points_balance   + v_final_payout,
        total_won        = total_won        + v_winner.total_gain
    where id = v_winner.player_id;

    update public.room_members
    set total_won_in_room = total_won_in_room + v_winner.total_gain
    where room_id   = v_prediction.room_id
      and player_id = v_winner.player_id;

    update public.bets
    set payout = v_final_payout
    where prediction_id = p_prediction_id
      and player_id     = v_winner.player_id;

    v_winners_count := v_winners_count + 1;
  end loop;

  update public.predictions
  set status            = 'revealed',
      winning_option_id = p_winning_option_id,
      resolved_at       = now()
  where id = p_prediction_id;

  return json_build_object(
    'resolved',          true,
    'outcome',           'revealed',
    'winning_option_id', p_winning_option_id,
    'winning_label',     v_winning_option.label,
    'winners',           v_winners_count,
    'losers',            v_losers_count
  );
end;
$$;

grant execute on function public.resolve_prediction_v2(uuid, uuid, text, uuid) to authenticated;


-- ============================================================
-- RPC: place_bet
-- Player bets on a prediction in a room they've joined.
-- ============================================================
drop function if exists public.place_bet(text, uuid, uuid, integer);

create or replace function public.place_bet(
  p_prediction_id uuid,
  p_option_id     uuid,
  p_amount        integer
)
returns json
language plpgsql
security definer
set search_path = public, private
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
  select * into v_player
  from public.players
  where user_id = auth.uid();

  if not found then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  select * into v_prediction
  from public.predictions
  where id = p_prediction_id and status = 'draft';

  if not found then
    raise exception 'Prediction not found or not in draft phase' using errcode = 'P0006';
  end if;

  select exists (
    select 1 from public.room_members
    where room_id = v_prediction.room_id and player_id = v_player.id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  if v_prediction.deadline <= now() then
    raise exception 'Betting deadline has passed' using errcode = 'P0007';
  end if;

  select * into v_option
  from public.prediction_options
  where id = p_option_id and prediction_id = p_prediction_id;

  if not found then
    raise exception 'Option does not belong to this prediction' using errcode = 'P0008';
  end if;

  if p_amount < 1 then
    raise exception 'Minimum bet is 1 point' using errcode = 'P0001';
  end if;

  select * into v_existing_bet
  from public.bets
  where prediction_id = p_prediction_id and player_id = v_player.id;

  if found then
    v_old_amount := v_existing_bet.amount;
  end if;

  v_available := v_player.points_balance - v_player.points_in_escrow + v_old_amount;

  if p_amount > v_available then
    raise exception 'Insufficient points. Available: %, Requested: %', v_available, p_amount
    using errcode = 'P0009';
  end if;

  v_escrow_delta := p_amount - v_old_amount;

  if found then
    update public.prediction_options
    set total_bet = total_bet - v_old_amount
    where id = v_existing_bet.option_id;

    update public.bets
    set option_id  = p_option_id,
        amount     = p_amount,
        updated_at = now()
    where id = v_existing_bet.id;
  else
    insert into public.bets (prediction_id, player_id, option_id, amount)
    values (p_prediction_id, v_player.id, p_option_id, p_amount);
  end if;

  update public.prediction_options
  set total_bet = total_bet + p_amount
  where id = p_option_id;

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

grant execute on function public.place_bet(uuid, uuid, integer) to authenticated;


-- ============================================================
-- RPC: cancel_bet
-- Player cancels their own bet during draft phase.
-- ============================================================
drop function if exists public.cancel_bet(text, uuid);

create or replace function public.cancel_bet(
  p_prediction_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player     public.players%rowtype;
  v_prediction public.predictions%rowtype;
  v_bet        public.bets%rowtype;
  v_is_member  boolean;
begin
  select * into v_player
  from public.players
  where user_id = auth.uid();

  if not found then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  select * into v_prediction
  from public.predictions
  where id = p_prediction_id and status = 'draft';

  if not found then
    raise exception 'Prediction not found or not in draft phase' using errcode = 'P0006';
  end if;

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

  update public.prediction_options
  set total_bet = total_bet - v_bet.amount
  where id = v_bet.option_id;

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

grant execute on function public.cancel_bet(uuid) to authenticated;


-- ============================================================
-- RPC: get_preferences
-- Returns global + per-room preferences for the authed player.
-- ============================================================
drop function if exists public.get_preferences(text, uuid);

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

grant execute on function public.get_preferences(uuid) to authenticated;


-- ============================================================
-- RPC: update_global_preferences
-- ============================================================
drop function if exists public.update_global_preferences(text, boolean, boolean, boolean, boolean, boolean, boolean, boolean);

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

grant execute on function public.update_global_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;


-- ============================================================
-- RPC: update_room_preferences
-- ============================================================
drop function if exists public.update_room_preferences(text, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean);

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

grant execute on function public.update_room_preferences(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;


-- ============================================================
-- RPC: reset_room_preferences
-- ============================================================
drop function if exists public.reset_room_preferences(text, uuid);

create or replace function public.reset_room_preferences(
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

  delete from public.room_preferences
  where room_id = p_room_id and player_id = v_player_id;

  return public.get_preferences(p_room_id);
end;
$$;

grant execute on function public.reset_room_preferences(uuid) to authenticated;


-- ============================================================
-- RPC: upsert_user_push_subscription
-- ============================================================
drop function if exists public.upsert_user_push_subscription(text, jsonb);

create or replace function public.upsert_user_push_subscription(
  p_subscription jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id              uuid;
  v_existing_user_id     uuid;
  v_subscription_id      uuid;
begin
  if coalesce(p_subscription->>'endpoint', '') = '' then
    raise exception 'Invalid subscription endpoint' using errcode = 'P0001';
  end if;

  v_user_id := private.get_player_id_from_auth();

  if v_user_id is null then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  select user_id into v_existing_user_id
  from public.user_push_subscriptions
  where subscription->>'endpoint' = p_subscription->>'endpoint';

  if v_existing_user_id is not null and v_existing_user_id <> v_user_id then
    raise exception 'Push subscription endpoint belongs to another user' using errcode = 'P0011';
  end if;

  insert into public.user_push_subscriptions (user_id, subscription)
  values (v_user_id, p_subscription)
  on conflict ((subscription->>'endpoint')) do update
  set subscription = excluded.subscription
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

grant execute on function public.upsert_user_push_subscription(jsonb) to authenticated;
