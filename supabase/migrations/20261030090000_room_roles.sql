-- ============================================================
-- Migration: room_roles
-- Description: Room roles (owner, organizer, resolver, member) so friends
--   can share organizing. Resolvers close predictions (reveal, no result,
--   cancel, including predictions still open for picks); organizers also
--   create and edit predictions and series; the owner manages the room and
--   its roles. Records who closed each prediction, adds staff tools
--   (manage queue, edit prediction, room settings) and a "result needed"
--   push to staff.
-- ============================================================

-- ------------------------------------------------------------
-- 1. room_members.role replaces is_organizer
-- ------------------------------------------------------------
alter table public.room_members
  add column if not exists role text not null default 'member';

alter table public.room_members drop constraint if exists room_members_role_check;
alter table public.room_members
  add constraint room_members_role_check
  check (role in ('owner', 'organizer', 'resolver', 'member'));

-- The first organizer in each room becomes its owner; any others stay organizers.
with first_organizer as (
  select distinct on (room_id) id, room_id
  from public.room_members
  where is_organizer
  order by room_id, joined_at, id
)
update public.room_members rm
set role = case when rm.id = fo.id then 'owner' else 'organizer' end
from first_organizer fo
where rm.room_id = fo.room_id
  and rm.is_organizer;

-- A room without any organizer gets its earliest member as owner.
with first_member as (
  select distinct on (room_id) id
  from public.room_members rm
  where not exists (
    select 1 from public.room_members o
    where o.room_id = rm.room_id and o.role = 'owner'
  )
  order by room_id, joined_at, id
)
update public.room_members rm
set role = 'owner'
from first_member fm
where rm.id = fm.id;

create unique index if not exists idx_room_members_one_owner
  on public.room_members (room_id)
  where role = 'owner';

-- is_organizer now follows role, so readers that still use it keep working.
alter table public.room_members drop column is_organizer;
alter table public.room_members
  add column is_organizer boolean
  generated always as (role in ('owner', 'organizer')) stored;

grant select (id, room_id, player_id, role, is_organizer, total_won_in_room, prediction_rating, peak_prediction_rating, rated_predictions_count, rating_system_version, joined_at) on public.room_members to authenticated;

-- ------------------------------------------------------------
-- 2. New columns
-- ------------------------------------------------------------
-- Who revealed, marked no result, or cancelled the prediction.
alter table public.predictions
  add column if not exists resolved_by uuid references public.players(id) on delete set null;

-- Set once staff have been pushed that a locked prediction needs its result.
alter table public.predictions
  add column if not exists notified_result_needed boolean not null default false;

grant select (id, room_id, series_id, series_prediction_number, created_by, title, status, deadline, winning_option_id, no_result_reason, affects_rating, resolved_at, resolved_by, notified_1h, notified_result_needed, created_at) on public.predictions to authenticated;

-- Hours after the deadline before staff get a "result needed" push.
alter table public.rooms
  add column if not exists result_reminder_hours integer not null default 3;

alter table public.rooms drop constraint if exists rooms_result_reminder_hours_check;
alter table public.rooms
  add constraint rooms_result_reminder_hours_check
  check (result_reminder_hours between 1 and 48);

grant select (id, room_code, name, description, status, created_at, predictions_limit, result_reminder_hours) on public.rooms to authenticated;

alter table public.player_preferences
  add column if not exists result_needed boolean not null default true;

-- ------------------------------------------------------------
-- 3. Existing functions check roles instead of is_organizer
--    (resolve_prediction_v2 also cancels open predictions and records
--    resolved_by; history and activities return who closed it)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_room(p_room_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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

  insert into public.room_members (room_id, player_id, role)
  values (v_room.id, v_player_id, 'owner');

  return json_build_object(
    'id',         v_room.id,
    'code',       v_room.room_code,
    'name',       v_room.name,
    'status',     v_room.status,
    'player_id',  v_player_id,
    'created_at', v_room.created_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.join_room(p_room_code text, p_ref text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_player_id uuid;
  v_player    public.players%rowtype;
  v_room      public.rooms%rowtype;
  v_member    public.room_members%rowtype;
  v_was_inserted boolean := false;
  v_ref       text;
begin
  -- Which shared link brought them in, e.g. "brag-card"; anything else is dropped.
  v_ref := lower(trim(p_ref));
  if v_ref !~ '^[a-z][a-z-]{0,31}$' then
    v_ref := null;
  end if;

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

  insert into public.room_members (room_id, player_id, joined_via)
  values (v_room.id, v_player_id, v_ref)
  on conflict (room_id, player_id) do nothing
  returning * into v_member;

  if found then
    v_was_inserted := true;
  else
    select * into v_member
    from public.room_members
    where room_id = v_room.id and player_id = v_player_id;
  end if;

  if v_was_inserted then
    perform private.ensure_series_wallet(s.id, v_player_id)
    from public.series s
    where s.room_id = v_room.id
      and s.status = 'active';

    perform private.create_room_activity(
      p_room_id := v_room.id,
      p_activity_type := 'room_joined',
      p_activity_tier := 2,
      p_metadata := jsonb_build_object(
        'member', jsonb_build_object(
          'id', v_player.id,
          'username', v_player.username
        )
      ),
      p_created_by_player_id := v_player.id,
      p_dedupe_key := 'room_joined:' || v_room.id::text || ':' || v_player.id::text
    );
  end if;

  return json_build_object(
    'id',           v_room.id,
    'code',         v_room.room_code,
    'name',         v_room.name,
    'status',       v_room.status,
    'player_id',    v_player_id,
    'username',     v_player.username,
    'is_organizer', v_member.is_organizer,
    'role',         v_member.role,
    'created_at',   v_room.created_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_room_by_code(p_room_code text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_player_id uuid;
  v_room      public.rooms%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select * into v_room
  from public.rooms
  where room_code = upper(trim(p_room_code));

  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;

  return json_build_object(
    'id',                v_room.id,
    'room_code',         v_room.room_code,
    'name',              v_room.name,
    'description',       v_room.description,
    'status',            v_room.status,
    'created_at',        v_room.created_at,
    'predictions_limit', v_room.predictions_limit,
    'result_reminder_hours', v_room.result_reminder_hours,
    'is_member',         private.is_room_member(v_room.id),
    'member_count', (
      select count(*)::int
      from public.room_members rm
      where rm.room_id = v_room.id
    ),
    'active_prediction_count', (
      select count(*)::int
      from public.predictions p
      where p.room_id = v_room.id
        and p.status in ('draft', 'locked')
    ),
    'organizer_username', (
      select pl.username
      from public.room_members rm
      join public.players pl on pl.id = rm.player_id
      where rm.room_id = v_room.id
        and rm.role = 'owner'
      order by rm.joined_at
      limit 1
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_prediction(p_room_id uuid, p_title text, p_options text[], p_deadline timestamp with time zone, p_series_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_player_id       uuid;
  v_member          public.room_members%rowtype;
  v_room            public.rooms%rowtype;
  v_prediction      public.predictions%rowtype;
  v_option          public.prediction_options%rowtype;
  v_option_ids      uuid[] := '{}';
  v_label           text;
  v_i               int;
  v_active_count    int;
  v_predictions_limit int;
  v_series          public.series%rowtype;
  v_series_prediction_number int;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  -- Owners and organizers create predictions
  select * into v_member
  from public.room_members
  where room_id = p_room_id
    and player_id = v_player_id
    and role in ('owner', 'organizer');

  if not found then
    raise exception 'Only organizers can create predictions' using errcode = 'P0012';
  end if;

  -- Fetch room to get the predictions_limit
  select * into v_room
  from public.rooms
  where id = p_room_id and status = 'active';

  if not found then
    raise exception 'Room not found or closed' using errcode = 'P0002';
  end if;

  v_predictions_limit := v_room.predictions_limit;

  -- Count currently active (draft or locked) predictions for this room
  select count(*) into v_active_count
  from public.predictions
  where room_id = p_room_id
    and status in ('draft', 'locked');

  if v_active_count >= v_predictions_limit then
    raise exception 'Active predictions limit reached (% / %). Resolve or cancel one first.',
      v_active_count, v_predictions_limit
    using errcode = 'P0005';
  end if;

  -- Validate options count
  if coalesce(array_length(p_options, 1), 0) < 2 or array_length(p_options, 1) > 6 then
    raise exception 'Predictions must have between 2 and 6 options' using errcode = 'P0001';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Prediction title cannot be empty' using errcode = 'P0001';
  end if;

  if p_deadline <= now() then
    raise exception 'Deadline must be in the future' using errcode = 'P0001';
  end if;

  -- Points live in series wallets, so every prediction needs a series.
  if p_series_id is null then
    raise exception 'Predictions must belong to an active series' using errcode = 'P0001';
  end if;

  select * into v_series
  from public.series
  where id = p_series_id
    and room_id = p_room_id
  for update;

  if not found then
    raise exception 'Series not found for this room' using errcode = 'P0002';
  end if;

  if v_series.status <> 'active' then
    raise exception 'Predictions can only be assigned to active series' using errcode = 'P0001';
  end if;

  select coalesce(max(series_prediction_number), 0) + 1
    into v_series_prediction_number
  from public.predictions
  where series_id = p_series_id;

  -- Create the prediction
  insert into public.predictions (
    room_id,
    series_id,
    series_prediction_number,
    created_by,
    title,
    deadline
  )
  values (
    p_room_id,
    p_series_id,
    v_series_prediction_number,
    v_player_id,
    trim(p_title),
    p_deadline
  )
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

  perform private.create_room_activity(
    p_room_id := p_room_id,
    p_activity_type := 'prediction_created',
    p_activity_tier := 2,
    p_metadata := private.build_prediction_activity_metadata(v_prediction.id),
    p_click_action := jsonb_build_object(
      'type', 'prediction',
      'predictionId', v_prediction.id
    ),
    p_created_by_player_id := v_player_id,
    p_dedupe_key := 'prediction_created:' || v_prediction.id::text
  );

  return json_build_object(
    'prediction_id', v_prediction.id,
    'title',         v_prediction.title,
    'status',        v_prediction.status,
    'deadline',      v_prediction.deadline,
    'option_ids',    v_option_ids,
    'room_id',       p_room_id,
    'series_id', v_prediction.series_id,
    'series_prediction_number', v_prediction.series_prediction_number
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.lock_prediction(p_prediction_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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
    and status = 'draft'
  for update;

  if not found then
    raise exception 'Prediction not found or not in draft phase' using errcode = 'P0006';
  end if;

  select * into v_member
  from public.room_members
  where room_id = v_prediction.room_id
    and player_id = v_player_id
    and role in ('owner', 'organizer');

  if not found then
    raise exception 'Only organizers can lock this prediction' using errcode = 'P0012';
  end if;

  update public.predictions
  set status = 'locked'
  where id = v_prediction.id
  returning * into v_prediction;

  perform private.create_room_activity(
    p_room_id := v_prediction.room_id,
    p_activity_type := 'prediction_locked',
    p_activity_tier := 1,
    p_metadata := private.build_prediction_activity_metadata(v_prediction.id),
    p_click_action := jsonb_build_object(
      'type', 'prediction',
      'predictionId', v_prediction.id
    ),
    p_created_by_player_id := v_player_id,
    p_dedupe_key := 'prediction_locked:' || v_prediction.id::text
  );

  return json_build_object(
    'locked',        true,
    'prediction_id', v_prediction.id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_prediction_v2(p_prediction_id uuid, p_room_id uuid, p_outcome text, p_winning_option_id uuid DEFAULT NULL::uuid, p_no_result_reason character varying DEFAULT NULL::character varying)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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
  v_effective_outcome text;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and player_id = v_player_id
      and role in ('owner', 'organizer', 'resolver')
  ) then
    raise exception 'Only room staff can close predictions' using errcode = 'P0012';
  end if;

  select * into v_prediction
  from public.predictions
  where id      = p_prediction_id
    and room_id = p_room_id
    -- Locked predictions can be closed any way; open ones can only be cancelled.
    and (status = 'locked' or (status = 'draft' and p_outcome = 'cancel'))
  -- Lock the prediction so a second resolve call waits, then finds it no longer locked.
  for update;

  if not found then
    raise exception 'Prediction not found or already closed' using errcode = 'P0006';
  end if;

  if p_outcome in ('no_result', 'cancel') then
    perform private.refund_all_bets_v2(p_prediction_id);

    v_effective_outcome := case
      when p_outcome = 'cancel' then 'cancelled'
      else p_outcome
    end;

    update public.predictions
    set status      = v_effective_outcome,
      no_result_reason = nullif(trim(p_no_result_reason), ''),
      resolved_at = now(),
      resolved_by = v_player_id
    where id = p_prediction_id
    returning * into v_prediction;

    perform public.update_player_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      v_effective_outcome
    );

    perform public.update_room_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      v_effective_outcome
    );

    perform private.create_room_activity(
      p_room_id := p_room_id,
      p_activity_type := case
        when v_effective_outcome = 'cancelled' then 'prediction_cancelled'
        else 'prediction_no_result'
      end,
      p_activity_tier := 1,
      p_metadata := private.build_prediction_activity_metadata(p_prediction_id),
      p_click_action := jsonb_build_object(
        'type', 'prediction',
        'predictionId', p_prediction_id
      ),
      p_created_by_player_id := v_player_id,
      p_dedupe_key := 'prediction_' || v_effective_outcome || ':' || p_prediction_id::text
    );

    return json_build_object(
      'resolved', true,
      'outcome',  v_effective_outcome,
      'refunded', true
    );
  end if;

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

  select count(distinct option_id) > 1 into v_multiple_sides
  from public.bets
  where prediction_id = p_prediction_id;

  if not v_multiple_sides then
    perform private.refund_all_bets_v2(p_prediction_id);

    update public.predictions
    set status = 'no_result',
        winning_option_id = p_winning_option_id,
        no_result_reason = coalesce(
          nullif(trim(p_no_result_reason), ''),
          'Only one option had bets — all refunded'
        ),
        resolved_at = now(),
        resolved_by = v_player_id
    where id = p_prediction_id
    returning * into v_prediction;

    perform public.update_player_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      'no_result'
    );

    perform public.update_room_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      'no_result'
    );

    perform private.create_room_activity(
      p_room_id := p_room_id,
      p_activity_type := 'prediction_no_result',
      p_activity_tier := 1,
      p_metadata := private.build_prediction_activity_metadata(p_prediction_id),
      p_click_action := jsonb_build_object(
        'type', 'prediction',
        'predictionId', p_prediction_id
      ),
      p_created_by_player_id := v_player_id,
      p_dedupe_key := 'prediction_no_result:' || p_prediction_id::text
    );

    return json_build_object(
      'resolved', true,
      'outcome', 'no_result',
      'reason', 'Only one option had bets — all refunded',
      'winning_option_id', p_winning_option_id,
      'refunded', true
    );
  end if;

  if v_winning_option.total_bet = 0 then
    perform private.refund_all_bets_v2(p_prediction_id);

    update public.predictions
    set status = 'no_result',
        winning_option_id = p_winning_option_id,
        no_result_reason = coalesce(
          nullif(trim(p_no_result_reason), ''),
          'Nobody bet on the winning option — all refunded'
        ),
        resolved_at = now(),
        resolved_by = v_player_id
    where id = p_prediction_id
    returning * into v_prediction;

    perform public.update_player_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      'no_result'
    );

    perform public.update_room_stats_after_resolution(
      p_room_id,
      p_prediction_id,
      null,
      'no_result'
    );

    perform private.create_room_activity(
      p_room_id := p_room_id,
      p_activity_type := 'prediction_no_result',
      p_activity_tier := 1,
      p_metadata := private.build_prediction_activity_metadata(p_prediction_id),
      p_click_action := jsonb_build_object(
        'type', 'prediction',
        'predictionId', p_prediction_id
      ),
      p_created_by_player_id := v_player_id,
      p_dedupe_key := 'prediction_no_result:' || p_prediction_id::text
    );

    return json_build_object(
      'resolved', true,
      'outcome', 'no_result',
      'reason', 'Nobody bet on the winning option — all refunded',
      'winning_option_id', p_winning_option_id,
      'refunded', true
    );
  end if;

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

    update public.series_wallets
    set escrow     = escrow  - v_loser.amount,
        balance    = balance - v_loser.amount + v_loser_refund,
        updated_at = now()
    where series_id = v_prediction.series_id
      and player_id = v_loser.player_id;

    update public.bets
    set payout = v_loser_refund
    where id = v_loser.bet_id;

    v_losers_count := v_losers_count + 1;
  end loop;

  for v_winner in select player_id, bet_amount, total_gain from _winner_gains loop
    v_final_payout := v_winner.bet_amount + v_winner.total_gain;

    update public.series_wallets
    set escrow     = escrow  - v_winner.bet_amount,
        balance    = balance + v_winner.total_gain,
        updated_at = now()
    where series_id = v_prediction.series_id
      and player_id = v_winner.player_id;

    -- Lifetime winnings stat shown on player profiles.
    update public.players
    set total_won = total_won + v_winner.total_gain
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
      resolved_at       = now(),
      resolved_by       = v_player_id
  where id = p_prediction_id
  returning * into v_prediction;

  perform public.update_prediction_ratings(
    p_room_id,
    p_prediction_id,
    p_winning_option_id
  );

  perform public.update_player_stats_after_resolution(
    p_room_id,
    p_prediction_id,
    p_winning_option_id,
    'win'
  );

  perform public.update_room_stats_after_resolution(
    p_room_id,
    p_prediction_id,
    p_winning_option_id,
    'win'
  );

  perform private.create_room_activity(
    p_room_id := p_room_id,
    p_activity_type := 'prediction_revealed',
    p_activity_tier := 1,
    p_metadata := private.build_prediction_activity_metadata(p_prediction_id),
    p_click_action := jsonb_build_object(
      'type', 'prediction',
      'predictionId', p_prediction_id
    ),
    p_created_by_player_id := v_player_id,
    p_dedupe_key := 'prediction_revealed:' || p_prediction_id::text
  );

  return json_build_object(
    'resolved',          true,
    'outcome',           'revealed',
    'winning_option_id', p_winning_option_id,
    'winning_label',     v_winning_option.label,
    'winners',           v_winners_count,
    'losers',            v_losers_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_series(p_room_id uuid, p_title text, p_description text DEFAULT NULL::text, p_expected_games integer DEFAULT 0, p_starting_stack integer DEFAULT 1000, p_weekly_topup integer DEFAULT 100, p_min_bets_to_rank integer DEFAULT 3)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_player_id uuid;
  v_member public.room_members%rowtype;
  v_series public.series%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select * into v_member
  from public.room_members
  where room_id = p_room_id
    and player_id = v_player_id
    and role in ('owner', 'organizer');

  if not found then
    raise exception 'Only organizers can manage series' using errcode = 'P0012';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Series title cannot be empty' using errcode = 'P0001';
  end if;

  if p_expected_games < 0 then
    raise exception 'Expected games cannot be negative' using errcode = 'P0001';
  end if;

  if p_starting_stack < 100 then
    raise exception 'Starting points must be at least 100' using errcode = 'P0001';
  end if;

  if p_weekly_topup < 0 then
    raise exception 'Weekly top-up cannot be negative' using errcode = 'P0001';
  end if;

  if p_min_bets_to_rank is null or p_min_bets_to_rank not between 0 and 50 then
    raise exception 'Minimum bets to be ranked must be between 0 and 50' using errcode = 'P0001';
  end if;

  insert into public.series (
    room_id,
    title,
    status,
    description,
    expected_games,
    created_by,
    started_at,
    starting_stack,
    weekly_topup,
    min_bets_to_rank,
    last_topup_week
  )
  values (
    p_room_id,
    trim(p_title),
    'active',
    nullif(trim(coalesce(p_description, '')), ''),
    p_expected_games,
    v_player_id,
    now(),
    p_starting_stack,
    p_weekly_topup,
    p_min_bets_to_rank,
    -- The first top-up is paid the Monday after the series starts.
    private.current_week_key()
  )
  returning * into v_series;

  perform private.ensure_series_wallet(v_series.id, rm.player_id)
  from public.room_members rm
  where rm.room_id = p_room_id;

  return row_to_json(v_series);
end;
$function$;

CREATE OR REPLACE FUNCTION public.activate_series(p_series_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_player_id uuid;
  v_series public.series%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select s.* into v_series
  from public.series s
  join public.room_members rm
    on rm.room_id = s.room_id
   and rm.player_id = v_player_id
   and rm.role in ('owner', 'organizer')
  where s.id = p_series_id
  for update;

  if not found then
    raise exception 'Series not found or access denied' using errcode = 'P0002';
  end if;

  if v_series.status <> 'draft' then
    raise exception 'Only draft series can be activated' using errcode = 'P0001';
  end if;

  update public.series
  set
    status = 'active',
    started_at = now(),
    last_topup_week = private.current_week_key()
  where id = p_series_id
  returning * into v_series;

  perform private.ensure_series_wallet(v_series.id, rm.player_id)
  from public.room_members rm
  where rm.room_id = v_series.room_id;

  return row_to_json(v_series);
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_series(p_series_id uuid, p_title text, p_description text DEFAULT NULL::text, p_expected_games integer DEFAULT 0, p_starting_stack integer DEFAULT NULL::integer, p_weekly_topup integer DEFAULT NULL::integer, p_min_bets_to_rank integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_player_id uuid;
  v_series public.series%rowtype;
  v_points_changed boolean;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select s.* into v_series
  from public.series s
  join public.room_members rm
    on rm.room_id = s.room_id
   and rm.player_id = v_player_id
   and rm.role in ('owner', 'organizer')
  where s.id = p_series_id
  for update;

  if not found then
    raise exception 'Series not found or access denied' using errcode = 'P0002';
  end if;

  if v_series.status = 'archived' then
    raise exception 'Archived series are read-only' using errcode = 'P0001';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Series title cannot be empty' using errcode = 'P0001';
  end if;

  if p_expected_games < 0 then
    raise exception 'Expected games cannot be negative' using errcode = 'P0001';
  end if;

  -- Unlike points, the ranking bar can change while a series runs: it moves no one's balance.
  if p_min_bets_to_rank is not null and p_min_bets_to_rank not between 0 and 50 then
    raise exception 'Minimum bets to be ranked must be between 0 and 50' using errcode = 'P0001';
  end if;

  if p_min_bets_to_rank is not null
    and p_min_bets_to_rank <> v_series.min_bets_to_rank
    and v_series.status not in ('draft', 'active') then
    raise exception 'Minimum bets to be ranked can only change before a series is closed' using errcode = 'P0001';
  end if;

  v_points_changed :=
    (p_starting_stack is not null and p_starting_stack <> v_series.starting_stack)
    or (p_weekly_topup is not null and p_weekly_topup <> v_series.weekly_topup);

  if v_points_changed then
    if v_series.status not in ('draft', 'active') then
      raise exception 'Points settings can only change before a series is closed' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.bets b
      join public.predictions p on p.id = b.prediction_id
      where p.series_id = p_series_id
    ) then
      raise exception 'Points settings can''t change once the series has bets' using errcode = 'P0001';
    end if;

    if coalesce(p_starting_stack, v_series.starting_stack) < 100 then
      raise exception 'Starting points must be at least 100' using errcode = 'P0001';
    end if;

    if coalesce(p_weekly_topup, v_series.weekly_topup) < 0 then
      raise exception 'Weekly top-up cannot be negative' using errcode = 'P0001';
    end if;
  end if;

  update public.series
  set
    title = trim(p_title),
    description = nullif(trim(coalesce(p_description, '')), ''),
    expected_games = p_expected_games,
    starting_stack = coalesce(p_starting_stack, starting_stack),
    weekly_topup = coalesce(p_weekly_topup, weekly_topup),
    min_bets_to_rank = coalesce(p_min_bets_to_rank, min_bets_to_rank)
  where id = p_series_id
  returning * into v_series;

  -- No bets yet, so every wallet is still untouched: reissue it with the new settings.
  if v_points_changed then
    update public.series_wallets
    set balance = v_series.starting_stack + v_series.weekly_topup * v_series.topups_paid,
        granted = v_series.starting_stack + v_series.weekly_topup * v_series.topups_paid,
        updated_at = now()
    where series_id = p_series_id;
  end if;

  return row_to_json(v_series);
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_series(p_series_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_player_id uuid;
  v_series public.series%rowtype;
  v_unfinished_predictions integer;
  v_required_bets integer;
  v_completed_predictions integer;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select s.* into v_series
  from public.series s
  join public.room_members rm
    on rm.room_id = s.room_id
   and rm.player_id = v_player_id
   and rm.role in ('owner', 'organizer')
  where s.id = p_series_id
  for update;

  if not found then
    raise exception 'Series not found or access denied' using errcode = 'P0002';
  end if;

  if v_series.status <> 'active' then
    raise exception 'Only active series can be completed' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.series_placements sp where sp.series_id = p_series_id
  ) or exists (
    select 1 from public.series_awards sa where sa.series_id = p_series_id
  ) then
    raise exception 'Series final results already exist' using errcode = 'P0001';
  end if;

  select count(*)::int
  into v_unfinished_predictions
  from public.predictions p
  where p.series_id = p_series_id
    and p.status in ('draft', 'locked');

  if v_unfinished_predictions > 0 then
    raise exception 'Series has unfinished predictions and cannot be completed' using errcode = 'P0001';
  end if;

  -- The same bar decides who can place and who can win awards.
  v_required_bets := private.series_required_bets(p_series_id);

  select count(*)::int
  into v_completed_predictions
  from public.predictions p
  where p.series_id = p_series_id
    and p.status in ('revealed', 'no_result');

  insert into public.series_placements (series_id, player_id, placement, points)
  with leaderboard as (
    select
      rm.player_id,
      coalesce(w.balance, v_series.starting_stack + coalesce(stats.net_profit, 0))::numeric as balance,
      coalesce(w.balance - w.granted, coalesce(stats.net_profit, 0))::numeric as net_profit
    from public.room_members rm
    left join public.series_wallets w
      on w.series_id = p_series_id
     and w.player_id = rm.player_id
    left join private.get_leaderboard_player_stats(
      v_series.room_id,
      p_series_id,
      false
    ) stats on stats.player_id = rm.player_id
    where rm.room_id = v_series.room_id
      -- Only players who bet on enough settled predictions can place.
      and coalesce(stats.total_bets, 0) >= v_required_bets
  ),
  -- The final balance decides the title; placements record net profit for the Hall of Fame.
  ranked as (
    select
      l.player_id,
      l.net_profit,
      rank() over (order by l.balance desc) as placement
    from leaderboard l
  )
  select
    p_series_id,
    r.player_id,
    r.placement,
    r.net_profit
  from ranked r
  where r.placement <= 3;

  insert into public.series_awards (series_id, player_id, award_type, value, description)
  with series_predictions as (
    select
      p.id,
      p.status,
      p.series_prediction_number,
      p.created_at,
      p.winning_option_id
    from public.predictions p
    where p.series_id = p_series_id
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as prediction_count
    from public.bets b
    join series_predictions sp
      on sp.id = b.prediction_id
     and sp.status in ('revealed', 'no_result')
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_required_bets
  ),
  revealed_player_results as (
    select
      b.player_id,
      coalesce(sp.series_prediction_number, 2147483647) as sort_number,
      sp.created_at,
      sp.id as prediction_id,
      (b.option_id = sp.winning_option_id) as is_win
    from public.bets b
    join series_predictions sp
      on sp.id = b.prediction_id
     and sp.status = 'revealed'
     and sp.winning_option_id is not null
    join eligible_players ep on ep.player_id = b.player_id
  ),
  win_groups as (
    select
      rpr.player_id,
      rpr.sort_number,
      rpr.created_at,
      rpr.prediction_id,
      rpr.is_win,
      sum(case when rpr.is_win then 0 else 1 end) over (
        partition by rpr.player_id
        order by rpr.sort_number asc, rpr.created_at asc, rpr.prediction_id asc
      ) as loss_group
    from revealed_player_results rpr
  ),
  streak_runs as (
    select
      wg.player_id,
      wg.is_win,
      row_number() over (
        partition by wg.player_id, wg.loss_group
        order by wg.sort_number asc, wg.created_at asc, wg.prediction_id asc
      ) as win_run
    from win_groups wg
  ),
  player_streaks as (
    select
      sr.player_id,
      coalesce(
        max(
          case
            when sr.is_win then sr.win_run
            else 0
          end
        ),
        0
      )::numeric as award_value
    from streak_runs sr
    group by sr.player_id
  ),
  top_value as (
    select max(ps.award_value) as value
    from player_streaks ps
  )
  select
    p_series_id,
    ps.player_id,
    'LONGEST_STREAK'::public.series_award_type,
    ps.award_value,
    'Achieved the longest winning streak in this Series.'
  from player_streaks ps
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and ps.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description)
  with series_predictions as (
    select p.id, p.status
    from public.predictions p
    where p.series_id = p_series_id
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as prediction_count
    from public.bets b
    join series_predictions sp
      on sp.id = b.prediction_id
     and sp.status in ('revealed', 'no_result')
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_required_bets
  ),
  player_biggest_profit as (
    select
      b.player_id,
      max(greatest(coalesce(b.payout, 0) - b.amount, 0))::numeric as award_value
    from public.bets b
    join series_predictions sp on sp.id = b.prediction_id
    join eligible_players ep on ep.player_id = b.player_id
    group by b.player_id
  ),
  top_value as (
    select max(pbp.award_value) as value
    from player_biggest_profit pbp
  )
  select
    p_series_id,
    pbp.player_id,
    'BIGGEST_PROFIT'::public.series_award_type,
    pbp.award_value,
    'Recorded the biggest single prediction profit.'
  from player_biggest_profit pbp
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and pbp.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description)
  with series_predictions as (
    select p.id, p.winning_option_id
    from public.predictions p
    where p.series_id = p_series_id
      and p.status = 'revealed'
      and p.winning_option_id is not null
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as prediction_count
    from public.bets b
    join public.predictions p on p.id = b.prediction_id
    where p.series_id = p_series_id
      and p.status in ('revealed', 'no_result')
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_required_bets
  ),
  duel_wins as (
    select
      winner.player_id,
      count(*)::numeric as award_value
    from public.duels d
    join series_predictions sp on sp.id = d.prediction_id
    join public.bets challenger_bet on challenger_bet.id = d.challenger_bet_id
    join public.bets opponent_bet on opponent_bet.id = d.matched_opponent_bet_id
    join lateral (
      select case
        when challenger_bet.option_id = sp.winning_option_id then d.challenger_player_id
        else d.matched_opponent_player_id
      end as player_id
    ) winner on true
    join eligible_players ep on ep.player_id = winner.player_id
    where d.status = 'resolved'
    group by winner.player_id
  ),
  top_value as (
    select max(dw.award_value) as value
    from duel_wins dw
  )
  select
    p_series_id,
    dw.player_id,
    'MOST_DUEL_WINS'::public.series_award_type,
    dw.award_value,
    'Won the most duels during this Series.'
  from duel_wins dw
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and dw.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description)
  with series_predictions as (
    select p.id, p.status
    from public.predictions p
    where p.series_id = p_series_id
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as prediction_count
    from public.bets b
    join series_predictions sp
      on sp.id = b.prediction_id
     and sp.status in ('revealed', 'no_result')
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_required_bets
  ),
  points_risked as (
    select
      b.player_id,
      sum(b.amount)::numeric as award_value
    from public.bets b
    join series_predictions sp on sp.id = b.prediction_id
    join eligible_players ep on ep.player_id = b.player_id
    group by b.player_id
  ),
  top_value as (
    select max(pr.award_value) as value
    from points_risked pr
  )
  select
    p_series_id,
    pr.player_id,
    'MOST_POINTS_RISKED'::public.series_award_type,
    pr.award_value,
    'Risked the most points during this Series.'
  from points_risked pr
  cross join top_value tv
  where tv.value is not null
    and tv.value > 0
    and pr.award_value = tv.value;

  insert into public.series_awards (series_id, player_id, award_type, value, description)
  with completed_predictions as (
    select p.id
    from public.predictions p
    where p.series_id = p_series_id
      and p.status in ('revealed', 'no_result')
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct p.id)::int as prediction_count
    from public.bets b
    join public.predictions p on p.id = b.prediction_id
    where p.series_id = p_series_id
      and p.status in ('revealed', 'no_result')
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_required_bets
  ),
  player_completed_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as completed_prediction_count
    from public.bets b
    join completed_predictions cp on cp.id = b.prediction_id
    group by b.player_id
  )
  select
    p_series_id,
    ep.player_id,
    'EVER_PRESENT'::public.series_award_type,
    v_completed_predictions::numeric,
    'Participated in every completed prediction.'
  from eligible_players ep
  left join player_completed_participation pcp on pcp.player_id = ep.player_id
  where v_completed_predictions > 0
    and coalesce(pcp.completed_prediction_count, 0) = v_completed_predictions;

  update public.series
  set
    status = 'completed',
    completed_at = now()
  where id = p_series_id
  returning * into v_series;

  return row_to_json(v_series);
end;
$function$;

CREATE OR REPLACE FUNCTION public.archive_series(p_series_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_player_id uuid;
  v_series public.series%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select s.* into v_series
  from public.series s
  join public.room_members rm
    on rm.room_id = s.room_id
   and rm.player_id = v_player_id
   and rm.role = 'owner'
  where s.id = p_series_id
  for update;

  if not found then
    raise exception 'Series not found or access denied' using errcode = 'P0002';
  end if;

  if v_series.status <> 'completed' then
    raise exception 'Only completed series can be archived' using errcode = 'P0001';
  end if;

  update public.series
  set
    status = 'archived',
    archived_at = now()
  where id = p_series_id
  returning * into v_series;

  return row_to_json(v_series);
end;
$function$;

CREATE OR REPLACE FUNCTION private.on_prediction_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_room_name text;
  v_series_title text;
  v_series_prediction_number integer;
  v_extra_payload jsonb;
begin
  select name into v_room_name from public.rooms where id = NEW.room_id;
  select s.title into v_series_title from public.series s where s.id = NEW.series_id;
  v_series_prediction_number := NEW.series_prediction_number;
  v_extra_payload := jsonb_build_object(
    'predictionId', NEW.id,
    'predictionTitle', NEW.title,
    'seriesId', NEW.series_id,
    'seriesTitle', v_series_title,
    'seriesPredictionNumber', v_series_prediction_number
  );

  -- New prediction published (draft = live for betting)
  if TG_OP = 'INSERT' and NEW.status = 'draft' then
    perform private.fire_push_notification(
      'prediction_live',
      NEW.id,
      NEW.room_id,
      '🎯 New Prediction',
      coalesce(v_room_name, 'Your room') || ' · ' || NEW.title,
      '/room/' || NEW.room_id::text,
      v_extra_payload
    );

  -- Organizer (or cron) locked the prediction
  elsif TG_OP = 'UPDATE'
    and OLD.status = 'draft'
    and NEW.status = 'locked'
  then
    perform private.fire_push_notification(
      'prediction_locked',
      NEW.id,
      NEW.room_id,
      '🔒 Betting Closed',
      coalesce(v_room_name, 'Your room') || ' · ' || NEW.title,
      '/room/' || NEW.room_id::text,
      v_extra_payload
    );

  -- Staff closed the prediction (win, no_result, or cancelled). Open
  -- predictions can be cancelled too, which refunds everyone.
  elsif TG_OP = 'UPDATE'
    and (
      (OLD.status = 'locked' and NEW.status in ('revealed', 'no_result', 'cancelled'))
      or (OLD.status = 'draft' and NEW.status = 'cancelled')
    )
  then
    perform private.fire_push_notification(
      'result_revealed',
      NEW.id,
      NEW.room_id,
      '🏆 Result Is In',
      coalesce(v_room_name, 'Your room') || ' · ' || NEW.title,
      '/room/' || NEW.room_id::text,
      v_extra_payload
    );
  end if;

  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_room_prediction_history(p_room_id uuid, p_limit integer DEFAULT 20, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid, p_search text DEFAULT NULL::text, p_filter text DEFAULT 'all'::text, p_series_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_result    json;
  v_filter text;
  v_search text;
begin
  v_caller_id := private.get_player_id_from_auth();
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_caller_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  p_limit  := greatest(1, least(p_limit, 100));
  v_filter := coalesce(nullif(lower(trim(p_filter)), ''), 'all');
  v_search := nullif(trim(p_search), '');

  /*
    Cursor pagination uses (created_at, id) so ordering is deterministic even when
    multiple predictions share the same created_at timestamp.
  */
  with fetched as (
    select
      pred.id             as prediction_id,
      pred.title,
      pred.status,
      pred.no_result_reason,
      pred.resolved_at,
      pred.created_at,
      pred.winning_option_id,
      pred.series_id,
      pred.series_prediction_number,
      s.title as series_title,
      user_bet.option_id  as selected_option_id,
      -- The caller's own stake and payout, for "you won / lost" on each card.
      user_bet.amount     as my_bet_amount,
      user_bet.payout     as my_payout,
      selected_opt.label  as selected_option_label,
      creator.username    as creator_username,
      resolver.username   as resolver_username,
      winning_opt.label   as winning_option_label,
      (
        select coalesce(sum(po.total_bet), 0)
        from public.prediction_options po
        where po.prediction_id = pred.id
      ) as total_pool,
      coalesce(bs.participant_count, 0) as participant_count,
      coalesce(bs.participant_count, 0) as total_bets,
      coalesce(bs.winner_count, 0) as winner_count,
      coalesce(bs.total_paid_to_winners, 0) as total_paid_to_winners,
      coalesce(bs.biggest_payout, 0) as biggest_payout,
      (
        select json_agg(
          json_build_object(
            'id',            po2.id,
            'label',         po2.label,
            'total_bet',     po2.total_bet,
            'display_order', po2.display_order
          ) order by po2.display_order
        )
        from public.prediction_options po2
        where po2.prediction_id = pred.id
      ) as options
    from public.predictions pred
    left join public.series s on s.id = pred.series_id
    join public.players creator on creator.id = pred.created_by
    left join public.players resolver on resolver.id = pred.resolved_by
    left join public.prediction_options winning_opt
      on winning_opt.id = pred.winning_option_id
    left join public.bets user_bet
      on user_bet.prediction_id = pred.id
      and user_bet.player_id = v_caller_id
    left join public.prediction_options selected_opt
      on selected_opt.id = user_bet.option_id
    left join (
      select
        b.prediction_id,
        count(*) as participant_count,
        count(*) filter (
          where pred2.status = 'revealed'
            and b.option_id = pred2.winning_option_id
        ) as winner_count,
        sum(
          case
            when pred2.status = 'revealed'
              then greatest(coalesce(b.payout, 0) - b.amount, 0)
            else 0
          end
        ) as total_paid_to_winners,
        max(
          case
            when pred2.status = 'revealed'
              then greatest(coalesce(b.payout, 0) - b.amount, 0)
            else 0
          end
        ) as biggest_payout
      from public.bets b
      join public.predictions pred2 on pred2.id = b.prediction_id
      where pred2.room_id = p_room_id
        and pred2.status in ('revealed', 'cancelled', 'no_result')
      group by b.prediction_id
    ) bs on bs.prediction_id = pred.id
    where pred.room_id = p_room_id
      and pred.status in ('revealed', 'cancelled', 'no_result')
      and (p_series_id is null or pred.series_id = p_series_id)
      and (
        p_cursor_created_at is null
        or p_cursor_id is null
        or (pred.created_at, pred.id) < (p_cursor_created_at, p_cursor_id)
      )
      and (
        v_search is null
        or coalesce(pred.title, '') ilike '%' || v_search || '%'
      )
      and case v_filter
        when 'wins' then (
          pred.status = 'revealed'
          and user_bet.option_id is not null
          and user_bet.option_id = pred.winning_option_id
        )
        when 'losses' then (
          pred.status = 'revealed'
          and user_bet.option_id is not null
          and user_bet.option_id <> pred.winning_option_id
        )
        when 'my_bets' then user_bet.option_id is not null
        else true
      end
    order by pred.created_at desc, pred.id desc
    limit p_limit + 1
  ),
  items as (
    select *
    from fetched
    order by created_at desc, prediction_id desc
    limit p_limit
  ),
  pagination as (
    select count(*) > p_limit as has_more
    from fetched
  ),
  tail_item as (
    select i.created_at, i.prediction_id
    from items i
    order by i.created_at asc, i.prediction_id asc
    limit 1
  )
  select json_build_object(
    'items', coalesce((select json_agg(i order by i.created_at desc, i.prediction_id desc) from items i), '[]'::json),
    'next_cursor_created_at', case when p.has_more then t.created_at else null end,
    'next_cursor_id', case when p.has_more then t.prediction_id else null end,
    'has_more', p.has_more
  )
  into v_result
  from pagination p
  left join tail_item t on true;

  return coalesce(
    v_result,
    json_build_object(
      'items', '[]'::json,
      'next_cursor_created_at', null,
      'next_cursor_id', null,
      'has_more', false
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_room_activities(p_room_id uuid, p_limit integer DEFAULT 20, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid, p_filter text DEFAULT 'all'::text, p_series_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_player_id uuid;
  v_limit integer;
  v_filter text;
  v_items json;
  v_next_cursor_created_at timestamptz;
  v_next_cursor_id uuid;
  v_has_more boolean := false;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = v_player_id
  ) then
    raise exception 'Only room members can view room activities' using errcode = 'P0013';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 50));
  v_filter := coalesce(lower(trim(p_filter)), 'all');

  with scoped as (
    select
      a.id,
      a.activity_type,
      a.activity_tier,
      a.metadata,
      a.click_action,
      a.created_at,
      a.created_by_player_id
    from public.room_activities a
    where a.room_id = p_room_id
      and (
        p_cursor_created_at is null
        or p_cursor_id is null
        or a.created_at < p_cursor_created_at
        or (a.created_at = p_cursor_created_at and a.id < p_cursor_id)
      )
      and (
        v_filter = 'all'
        or (v_filter = 'predictions' and a.activity_type like 'prediction_%')
        or (v_filter = 'duels' and a.activity_type like 'duel_%')
        or (v_filter = 'members' and a.activity_type like 'room_%')
        or (v_filter = 'achievements' and a.activity_type like 'achievement_%')
      )
      and (
        p_series_id is null
        or exists (
          select 1
          from public.predictions p
          where p.id = case
            when coalesce(
              a.metadata ->> 'predictionId',
              a.metadata #>> '{duel,predictionId}',
              a.click_action ->> 'predictionId'
            ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then coalesce(
              a.metadata ->> 'predictionId',
              a.metadata #>> '{duel,predictionId}',
              a.click_action ->> 'predictionId'
            )::uuid
            else null
          end
            and p.series_id = p_series_id
        )
      )
    order by a.created_at desc, a.id desc
    limit v_limit + 1
  ),
  limited as (
    select *
    from scoped
    order by created_at desc, id desc
    limit v_limit
  ),
  next_cursor as (
    select s.created_at, s.id
    from scoped s
    order by s.created_at desc, s.id desc
    offset v_limit
    limit 1
  )
  select
    coalesce(
      json_agg(
        json_build_object(
          'id', l.id,
          'activityType', l.activity_type,
          'activityTier', l.activity_tier,
          'metadata', l.metadata,
          'clickAction', l.click_action,
          'createdAt', l.created_at,
          -- Who acted, e.g. the staff member who revealed a result.
          'createdBy', (
            select json_build_object('id', pl.id, 'username', pl.username)
            from public.players pl
            where pl.id = l.created_by_player_id
          )
        )
        order by l.created_at desc, l.id desc
      ),
      '[]'::json
    ),
    (select created_at from next_cursor),
    (select id from next_cursor),
    exists(select 1 from next_cursor)
  into v_items, v_next_cursor_created_at, v_next_cursor_id, v_has_more
  from limited l;

  return json_build_object(
    'items', v_items,
    'next_cursor_created_at', v_next_cursor_created_at,
    'next_cursor_id', v_next_cursor_id,
    'has_more', v_has_more
  );
end;
$function$;

-- ------------------------------------------------------------
-- 4. New functions
-- ------------------------------------------------------------
-- Owner only. Makes a member an organizer, resolver or plain member.
-- Ownership moves with transfer_ownership, never here.
create or replace function public.set_member_role(
  p_room_id   uuid,
  p_player_id uuid,
  p_role      text
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_target    public.room_members%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and player_id = v_player_id
      and role = 'owner'
  ) then
    raise exception 'Only the room owner can change roles' using errcode = 'P0012';
  end if;

  if p_role is null or p_role not in ('organizer', 'resolver', 'member') then
    raise exception 'Role must be organizer, resolver or member' using errcode = 'P0001';
  end if;

  select * into v_target
  from public.room_members
  where room_id = p_room_id
    and player_id = p_player_id
  for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  if v_target.role = 'owner' then
    raise exception 'The owner''s role can''t be changed. Transfer ownership instead.' using errcode = 'P0001';
  end if;

  update public.room_members
  set role = p_role
  where id = v_target.id;

  return json_build_object('player_id', p_player_id, 'role', p_role);
end;
$$;

-- Owner only. The new owner takes over; the old owner stays on as an organizer.
create or replace function public.transfer_ownership(
  p_room_id   uuid,
  p_player_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  perform 1
  from public.room_members
  where room_id = p_room_id
    and player_id = v_player_id
    and role = 'owner'
  for update;

  if not found then
    raise exception 'Only the room owner can transfer ownership' using errcode = 'P0012';
  end if;

  if p_player_id = v_player_id then
    raise exception 'You already own this room' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and player_id = p_player_id
  ) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  -- Step down first: a room has exactly one owner at any moment.
  update public.room_members
  set role = 'organizer'
  where room_id = p_room_id and player_id = v_player_id;

  update public.room_members
  set role = 'owner'
  where room_id = p_room_id and player_id = p_player_id;

  return json_build_object('owner_id', p_player_id, 'previous_owner_id', v_player_id);
end;
$$;

-- Owner only. Room name, description and staff settings.
create or replace function public.update_room(
  p_room_id               uuid,
  p_name                  text,
  p_description           text,
  p_predictions_limit     integer,
  p_result_reminder_hours integer
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

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and player_id = v_player_id
      and role = 'owner'
  ) then
    raise exception 'Only the room owner can change room settings' using errcode = 'P0012';
  end if;

  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Room name cannot be empty' using errcode = 'P0001';
  end if;

  if length(trim(p_name)) > 50 then
    raise exception 'Room name must be 50 characters or fewer' using errcode = 'P0001';
  end if;

  if length(coalesce(p_description, '')) > 240 then
    raise exception 'Description must be 240 characters or fewer' using errcode = 'P0001';
  end if;

  if p_predictions_limit is null or p_predictions_limit not between 1 and 20 then
    raise exception 'Open predictions limit must be between 1 and 20' using errcode = 'P0001';
  end if;

  if p_result_reminder_hours is null or p_result_reminder_hours not between 1 and 48 then
    raise exception 'Result reminder must be between 1 and 48 hours' using errcode = 'P0001';
  end if;

  update public.rooms
  set name                  = trim(p_name),
      description           = nullif(trim(coalesce(p_description, '')), ''),
      predictions_limit     = p_predictions_limit,
      result_reminder_hours = p_result_reminder_hours
  where id = p_room_id
  returning * into v_room;

  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;

  return json_build_object(
    'id',                    v_room.id,
    'name',                  v_room.name,
    'description',           v_room.description,
    'predictions_limit',     v_room.predictions_limit,
    'result_reminder_hours', v_room.result_reminder_hours
  );
end;
$$;

-- Organizers fix a prediction that's still open for picks: title, deadline,
-- and the options while nobody has bet. Pass null options to keep them.
create or replace function public.update_prediction(
  p_prediction_id uuid,
  p_title         text,
  p_deadline      timestamptz,
  p_options       text[] default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id  uuid;
  v_prediction public.predictions%rowtype;
  v_labels     text[];
  v_current    text[];
  v_i          int;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select * into v_prediction
  from public.predictions
  where id = p_prediction_id
  for update;

  if not found then
    raise exception 'Prediction not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = v_prediction.room_id
      and player_id = v_player_id
      and role in ('owner', 'organizer')
  ) then
    raise exception 'Only organizers can edit predictions' using errcode = 'P0012';
  end if;

  if v_prediction.status <> 'draft' or v_prediction.deadline <= now() then
    raise exception 'Only predictions still open for picks can be edited' using errcode = 'P0006';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Prediction title cannot be empty' using errcode = 'P0001';
  end if;

  if p_deadline is null or p_deadline <= now() then
    raise exception 'Deadline must be in the future' using errcode = 'P0001';
  end if;

  if p_options is not null then
    if coalesce(array_length(p_options, 1), 0) < 2 or array_length(p_options, 1) > 6 then
      raise exception 'Predictions must have between 2 and 6 options' using errcode = 'P0001';
    end if;

    v_labels := array(select trim(o) from unnest(p_options) with ordinality as t(o, n) order by n);

    if exists (select 1 from unnest(v_labels) l where length(l) = 0) then
      raise exception 'Option labels cannot be empty' using errcode = 'P0001';
    end if;

    v_current := array(
      select label from public.prediction_options
      where prediction_id = p_prediction_id
      order by display_order, created_at
    );

    if v_labels is distinct from v_current then
      if exists (select 1 from public.bets where prediction_id = p_prediction_id) then
        raise exception 'Options can''t change once someone has bet' using errcode = 'P0001';
      end if;

      delete from public.prediction_options where prediction_id = p_prediction_id;

      for v_i in 1 .. array_length(v_labels, 1) loop
        insert into public.prediction_options (prediction_id, label, display_order)
        values (p_prediction_id, v_labels[v_i], v_i - 1);
      end loop;
    end if;
  end if;

  update public.predictions
  set title       = trim(p_title),
      deadline    = p_deadline,
      -- A moved deadline earns a fresh "1 hour left" reminder.
      notified_1h = case when p_deadline = deadline then notified_1h else false end
  where id = p_prediction_id;

  return json_build_object(
    'id',       p_prediction_id,
    'title',    trim(p_title),
    'deadline', p_deadline
  );
end;
$$;

-- Staff only. Everything waiting on staff across the room, oldest first:
-- locked predictions to close, and predictions still open for picks.
create or replace function public.get_room_manage_queue(
  p_room_id uuid
)
returns json
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_role      text;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  select role into v_role
  from public.room_members
  where room_id = p_room_id
    and player_id = v_player_id;

  if v_role is null or v_role not in ('owner', 'organizer', 'resolver') then
    raise exception 'Only room staff can see the manage queue' using errcode = 'P0012';
  end if;

  return (
    with queue as (
      select
        p.id,
        p.title,
        p.status,
        p.deadline,
        p.series_id,
        p.series_prediction_number,
        s.title as series_title,
        (select count(*)::int from public.bets b where b.prediction_id = p.id) as bet_count,
        (
          select coalesce(sum(po.total_bet), 0)::int
          from public.prediction_options po
          where po.prediction_id = p.id
        ) as total_pool
      from public.predictions p
      left join public.series s on s.id = p.series_id
      where p.room_id = p_room_id
        and p.status in ('draft', 'locked')
    )
    select json_build_object(
      'role', v_role,
      'to_resolve', coalesce(
        (select json_agg(q order by q.deadline, q.id) from queue q where q.status = 'locked'),
        '[]'::json
      ),
      'open', coalesce(
        (select json_agg(q order by q.deadline, q.id) from queue q where q.status = 'draft'),
        '[]'::json
      )
    )
  );
end;
$$;

-- Cron, every 10 minutes: push room staff about predictions that locked a
-- while ago (rooms.result_reminder_hours past the deadline) and still have
-- no result. Each prediction is pushed once.
create or replace function private.fire_push_notification_for_result_needed()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_rec record;
begin
  for v_rec in
    select
      p.id,
      p.room_id,
      p.title,
      p.series_id,
      p.series_prediction_number,
      s.title as series_title,
      r.name as room_name
    from public.predictions p
    join public.rooms r on r.id = p.room_id
    left join public.series s on s.id = p.series_id
    where p.status = 'locked'
      and p.notified_result_needed = false
      and p.deadline + make_interval(hours => r.result_reminder_hours) <= now()
  loop
    -- Mark first so a concurrent run does not double-send.
    update public.predictions
    set notified_result_needed = true
    where id = v_rec.id
      and notified_result_needed = false;

    if found then
      perform private.fire_push_notification(
        'result_needed',
        v_rec.id,
        v_rec.room_id,
        '⚑ Result needed',
        coalesce(v_rec.room_name, 'Your room') || ' · ' || v_rec.title,
        '/room/' || v_rec.room_id::text,
        jsonb_build_object(
          'predictionId', v_rec.id,
          'predictionTitle', v_rec.title,
          'seriesId', v_rec.series_id,
          'seriesTitle', v_rec.series_title,
          'seriesPredictionNumber', v_rec.series_prediction_number,
          -- Only staff get this one.
          'roles', jsonb_build_array('owner', 'organizer', 'resolver')
        )
      );
    end if;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 5. Grants
-- ------------------------------------------------------------
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.transfer_ownership(uuid, uuid) from public, anon;
revoke execute on function public.update_room(uuid, text, text, integer, integer) from public, anon;
revoke execute on function public.update_prediction(uuid, text, timestamp with time zone, text[]) from public, anon;
revoke execute on function public.get_room_manage_queue(uuid) from public, anon;
revoke execute on function private.fire_push_notification_for_result_needed() from public, anon, authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
grant execute on function public.update_room(uuid, text, text, integer, integer) to authenticated;
grant execute on function public.update_prediction(uuid, text, timestamp with time zone, text[]) to authenticated;
grant execute on function public.get_room_manage_queue(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. "Result needed" push to staff, every 10 minutes
-- ------------------------------------------------------------
select cron.schedule('push-result-needed', '*/10 * * * *', $$select private.fire_push_notification_for_result_needed()$$);
