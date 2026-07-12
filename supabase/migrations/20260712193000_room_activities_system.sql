-- ============================================================
-- Migration: room_activities_system
-- Description: Canonical room activities feed (event store + query API)
-- ============================================================

create table if not exists public.room_activities (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  activity_type text not null,
  activity_tier smallint not null check (activity_tier between 1 and 3),
  metadata jsonb not null default '{}'::jsonb,
  click_action jsonb,
  created_by_player_id uuid references public.players(id) on delete set null,
  dedupe_key text,
  created_at timestamptz not null default now()
);

create index if not exists idx_room_activities_room_created
  on public.room_activities (room_id, created_at desc, id desc);

create index if not exists idx_room_activities_room_type_created
  on public.room_activities (room_id, activity_type, created_at desc, id desc);

create unique index if not exists uq_room_activities_room_dedupe
  on public.room_activities (room_id, dedupe_key)
  where dedupe_key is not null;

alter table public.room_activities enable row level security;
revoke all on public.room_activities from anon;

drop policy if exists "room_activities_select" on public.room_activities;
create policy "room_activities_select"
on public.room_activities
for select
using (
  exists (
    select 1
    from public.room_members rm
    where rm.room_id = room_activities.room_id
      and rm.player_id = private.get_player_id_from_auth()
  )
);

drop policy if exists "room_activities_no_direct_insert" on public.room_activities;
create policy "room_activities_no_direct_insert"
on public.room_activities
for insert
with check (false);

drop policy if exists "room_activities_no_direct_update" on public.room_activities;
create policy "room_activities_no_direct_update"
on public.room_activities
for update
using (false);

drop policy if exists "room_activities_no_direct_delete" on public.room_activities;
create policy "room_activities_no_direct_delete"
on public.room_activities
for delete
using (false);

grant select (id, room_id, activity_type, activity_tier, metadata, click_action, created_by_player_id, created_at)
  on public.room_activities to authenticated;

create or replace function private.create_room_activity(
  p_room_id uuid,
  p_activity_type text,
  p_activity_tier smallint,
  p_metadata jsonb default '{}'::jsonb,
  p_click_action jsonb default null,
  p_created_by_player_id uuid default null,
  p_dedupe_key text default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.room_activities (
    room_id,
    activity_type,
    activity_tier,
    metadata,
    click_action,
    created_by_player_id,
    dedupe_key
  )
  values (
    p_room_id,
    p_activity_type,
    p_activity_tier,
    coalesce(p_metadata, '{}'::jsonb),
    p_click_action,
    p_created_by_player_id,
    p_dedupe_key
  )
  on conflict (room_id, dedupe_key) do nothing;
end;
$$;

create or replace function private.build_prediction_activity_metadata(
  p_prediction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_prediction public.predictions%rowtype;
  v_total_bets integer := 0;
  v_total_wagered integer := 0;
  v_option_totals jsonb := '[]'::jsonb;
  v_winning_option_label text := null;
begin
  select * into v_prediction
  from public.predictions
  where id = p_prediction_id;

  if not found then
    return '{}'::jsonb;
  end if;

  select
    count(*)::int,
    coalesce(sum(amount), 0)::int
  into v_total_bets, v_total_wagered
  from public.bets
  where prediction_id = p_prediction_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'optionId', po.id,
        'label', po.label,
        'totalBet', po.total_bet,
        'displayOrder', po.display_order
      )
      order by po.display_order asc
    ),
    '[]'::jsonb
  )
  into v_option_totals
  from public.prediction_options po
  where po.prediction_id = p_prediction_id;

  if v_prediction.winning_option_id is not null then
    select po.label into v_winning_option_label
    from public.prediction_options po
    where po.id = v_prediction.winning_option_id;
  end if;

  return jsonb_build_object(
    'predictionId', v_prediction.id,
    'title', v_prediction.title,
    'status', v_prediction.status,
    'deadline', v_prediction.deadline,
    'resolvedAt', v_prediction.resolved_at,
    'winningOptionId', v_prediction.winning_option_id,
    'winningOptionLabel', v_winning_option_label,
    'noResultReason', v_prediction.no_result_reason,
    'totalBets', v_total_bets,
    'totalWagered', v_total_wagered,
    'optionTotals', v_option_totals
  );
end;
$$;

create or replace function private.build_duel_activity_metadata(
  p_duel_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_duel public.duels%rowtype;
  v_prediction public.predictions%rowtype;
  v_challenger public.players%rowtype;
  v_opponent public.players%rowtype;
  v_winner public.players%rowtype;
  v_challenger_bet public.bets%rowtype;
  v_opponent_bet public.bets%rowtype;
  v_winner_player_id uuid := null;
begin
  select * into v_duel
  from public.duels
  where id = p_duel_id;

  if not found then
    return '{}'::jsonb;
  end if;

  select * into v_prediction
  from public.predictions
  where id = v_duel.prediction_id;

  select * into v_challenger
  from public.players
  where id = v_duel.challenger_player_id;

  if v_duel.matched_opponent_player_id is not null then
    select * into v_opponent
    from public.players
    where id = v_duel.matched_opponent_player_id;
  end if;

  if v_duel.status = 'resolved'
     and v_prediction.winning_option_id is not null
     and v_duel.matched_opponent_bet_id is not null then
    select * into v_challenger_bet
    from public.bets
    where id = v_duel.challenger_bet_id;

    select * into v_opponent_bet
    from public.bets
    where id = v_duel.matched_opponent_bet_id;

    if found and v_challenger_bet.option_id = v_prediction.winning_option_id then
      v_winner_player_id := v_duel.challenger_player_id;
    elsif v_opponent_bet.option_id = v_prediction.winning_option_id then
      v_winner_player_id := v_duel.matched_opponent_player_id;
    end if;
  end if;

  if v_winner_player_id is not null then
    select * into v_winner
    from public.players
    where id = v_winner_player_id;
  end if;

  return jsonb_build_object(
    'duelId', v_duel.id,
    'predictionId', v_duel.prediction_id,
    'predictionTitle', v_prediction.title,
    'status', v_duel.status,
    'challenger', jsonb_build_object(
      'id', v_challenger.id,
      'username', v_challenger.username
    ),
    'opponent', case
      when v_duel.matched_opponent_player_id is null then null
      else jsonb_build_object(
        'id', v_opponent.id,
        'username', v_opponent.username
      )
    end,
    'winner', case
      when v_winner_player_id is null then null
      else jsonb_build_object(
        'id', v_winner.id,
        'username', v_winner.username
      )
    end,
    'stakeAmount', v_duel.stake_amount,
    'payout', case
      when v_duel.status = 'resolved' and v_winner_player_id is not null then v_duel.stake_amount * 2
      else null
    end,
    'createdAt', v_duel.created_at,
    'matchedAt', v_duel.matched_at,
    'resolvedAt', v_duel.resolved_at
  );
end;
$$;

create or replace function public.get_room_activities(
  p_room_id uuid,
  p_limit integer default 20,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_filter text default 'all'
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
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
      a.created_at
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
          'createdAt', l.created_at
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
$$;

create or replace function private.log_duel_event(
  p_duel_id uuid,
  p_prediction_id uuid,
  p_event_type text,
  p_event_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_room_id uuid;
  v_activity_type text;
  v_activity_tier smallint;
  v_metadata jsonb;
begin
  insert into private.duel_events (duel_id, prediction_id, event_type, event_payload)
  values (p_duel_id, p_prediction_id, p_event_type, coalesce(p_event_payload, '{}'::jsonb));

  select p.room_id into v_room_id
  from public.predictions p
  where p.id = p_prediction_id;

  if v_room_id is null then
    return;
  end if;

  if p_event_type = 'duel_created' then
    v_activity_type := 'duel_created';
    v_activity_tier := 2;
  elsif p_event_type = 'duel_matched' then
    v_activity_type := 'duel_matched';
    v_activity_tier := 1;
  elsif p_event_type = 'duel_resolved' then
    v_activity_type := 'duel_resolved';
    v_activity_tier := 1;
  elsif p_event_type = 'duel_cancelled' then
    if coalesce(p_event_payload ->> 'final_status', '') = 'expired' then
      v_activity_type := 'duel_expired';
      v_activity_tier := 2;
    else
      v_activity_type := 'duel_cancelled';
      v_activity_tier := 2;
    end if;
  else
    return;
  end if;

  v_metadata := private.build_duel_activity_metadata(p_duel_id);

  perform private.create_room_activity(
    p_room_id := v_room_id,
    p_activity_type := v_activity_type,
    p_activity_tier := v_activity_tier,
    p_metadata := v_metadata,
    p_click_action := jsonb_build_object(
      'type', 'duel',
      'predictionId', coalesce(v_metadata ->> 'predictionId', p_prediction_id::text),
      'duelId', p_duel_id
    ),
    p_created_by_player_id := coalesce((p_event_payload ->> 'cancelled_by')::uuid, null),
    p_dedupe_key := v_activity_type || ':' || p_duel_id::text
  );
end;
$$;

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
  v_was_inserted boolean := false;
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
    'created_at',   v_room.created_at
  );
end;
$$;

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
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  -- Verify caller is the room organizer
  select * into v_member
  from public.room_members
  where room_id = p_room_id
    and player_id = v_player_id
    and is_organizer = true;

  if not found then
    raise exception 'Only the organizer can create predictions' using errcode = 'P0012';
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
  if array_length(p_options, 1) < 2 or array_length(p_options, 1) > 6 then
    raise exception 'Predictions must have between 2 and 6 options' using errcode = 'P0001';
  end if;

  if length(trim(p_title)) = 0 then
    raise exception 'Prediction title cannot be empty' using errcode = 'P0001';
  end if;

  if p_deadline <= now() then
    raise exception 'Deadline must be in the future' using errcode = 'P0001';
  end if;

  -- Create the prediction
  insert into public.predictions (room_id, created_by, title, deadline)
  values (p_room_id, v_player_id, trim(p_title), p_deadline)
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
    'room_id',       p_room_id
  );
end;
$$;

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
$$;

create or replace function public.resolve_prediction_v2(
  p_prediction_id     uuid,
  p_room_id           uuid,
  p_outcome           text,
  p_winning_option_id uuid default null,
  p_no_result_reason  varchar(50) default null
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

  if p_outcome in ('no_result', 'cancel') then
    perform private.refund_all_bets_v2(p_prediction_id);

    v_effective_outcome := case
      when p_outcome = 'cancel' then 'cancelled'
      else p_outcome
    end;

    update public.predictions
    set status      = v_effective_outcome,
      no_result_reason = nullif(trim(p_no_result_reason), ''),
      resolved_at = now()
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
        resolved_at = now()
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
        resolved_at = now()
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
$$;

grant execute on function public.get_room_activities(uuid, integer, timestamptz, uuid, text) to authenticated;

revoke all on function private.create_room_activity(uuid, text, smallint, jsonb, jsonb, uuid, text) from public;
revoke all on function private.create_room_activity(uuid, text, smallint, jsonb, jsonb, uuid, text) from authenticated;

revoke all on function private.build_prediction_activity_metadata(uuid) from public;
revoke all on function private.build_prediction_activity_metadata(uuid) from authenticated;

revoke all on function private.build_duel_activity_metadata(uuid) from public;
revoke all on function private.build_duel_activity_metadata(uuid) from authenticated;
