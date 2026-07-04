-- ============================================================
-- Migration: duel_queue_history_status
-- Description: Preserve duel queue rows as history via status transitions.
-- ============================================================

alter table public.duel_queue
  add column if not exists status text not null default 'waiting'
  check (status in ('waiting', 'matched', 'refunded', 'cancelled'));

create index if not exists idx_duel_queue_duel_status_created
  on public.duel_queue (duel_id, status, created_at);

alter table public.duel_queue
  drop constraint if exists duel_queue_duel_id_player_id_key;

create unique index if not exists uq_duel_queue_active_player
  on public.duel_queue (duel_id, player_id)
  where status in ('waiting', 'matched');

grant select (id, duel_id, player_id, bet_id, status, created_at) on public.duel_queue to anon;
grant select (id, duel_id, player_id, bet_id, status, created_at) on public.duel_queue to authenticated;

create or replace function private.enforce_duel_queue_status_transition()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;

  if OLD.status in ('matched', 'refunded', 'cancelled') and NEW.status <> OLD.status then
    raise exception 'Queue status is terminal and cannot transition' using errcode = 'P0001';
  end if;

  if OLD.status = 'waiting'
     and NEW.status not in ('waiting', 'matched', 'refunded', 'cancelled') then
    raise exception 'Invalid queue status transition' using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_duel_queue_status_transition on public.duel_queue;
create trigger trg_enforce_duel_queue_status_transition
before update on public.duel_queue
for each row execute function private.enforce_duel_queue_status_transition();

create or replace function private.prevent_locked_duel_bet_changes()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if TG_OP = 'UPDATE'
     and NEW.prediction_id is not distinct from OLD.prediction_id
     and NEW.player_id is not distinct from OLD.player_id
     and NEW.option_id is not distinct from OLD.option_id
     and NEW.amount is not distinct from OLD.amount then
    return NEW;
  end if;

  if exists (
    select 1
    from public.duels d
    where d.status in ('created', 'queued', 'matched')
      and (
        d.challenger_bet_id = OLD.id
        or d.matched_opponent_bet_id = OLD.id
      )
  ) then
    raise exception 'Bet is locked by an active duel' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.duel_queue dq
    join public.duels d on d.id = dq.duel_id
    where dq.bet_id = OLD.id
      and dq.status in ('waiting', 'matched')
      and d.status in ('created', 'queued', 'matched')
  ) then
    raise exception 'Bet is locked while queued for an active duel' using errcode = 'P0001';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  return NEW;
end;
$$;

create or replace function public.join_duel_queue(
  p_duel_id uuid,
  p_player_id uuid,
  p_bet_id uuid
)
returns public.duels
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_auth_player_id uuid;
  v_duel public.duels%rowtype;
  v_player public.players%rowtype;
  v_bet public.bets%rowtype;
  v_queue_exists boolean;
  v_available integer;
  v_prediction_status text;
begin
  v_auth_player_id := private.get_player_id_from_auth();

  if v_auth_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if v_auth_player_id <> p_player_id then
    raise exception 'You can only join duel queues for yourself' using errcode = 'P0013';
  end if;

  select * into v_duel
  from public.duels
  where id = p_duel_id
  for update;

  if not found then
    raise exception 'Duel not found' using errcode = 'P0006';
  end if;

  if v_duel.status not in ('created', 'queued') then
    raise exception 'Duel is not open for joining' using errcode = 'P0001';
  end if;

  select p.status into v_prediction_status
  from public.predictions p
  where p.id = v_duel.prediction_id
  for update;

  if v_prediction_status is distinct from 'draft' then
    raise exception 'Prediction not found or not in draft phase' using errcode = 'P0006';
  end if;

  if p_player_id = v_duel.challenger_player_id then
    raise exception 'Challenger cannot join own duel queue' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.duel_queue
    where duel_id = p_duel_id
      and player_id = p_player_id
      and status in ('waiting', 'matched')
  ) into v_queue_exists;

  if v_queue_exists then
    raise exception 'Player is already in this duel queue' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.duels d
    where d.prediction_id = v_duel.prediction_id
      and d.status in ('created', 'queued', 'matched')
      and (
        d.challenger_player_id = p_player_id
        or d.matched_opponent_player_id = p_player_id
        or exists (
          select 1
          from public.duel_queue dq
          where dq.duel_id = d.id
            and dq.player_id = p_player_id
            and dq.status in ('waiting', 'matched')
        )
      )
  ) then
    raise exception 'Player already has an active duel for this prediction' using errcode = 'P0001';
  end if;

  select * into v_bet
  from public.bets
  where id = p_bet_id
    and player_id = p_player_id
    and prediction_id = v_duel.prediction_id
  for update;

  if not found then
    raise exception 'Bet not found for this prediction/player' using errcode = 'P0006';
  end if;

  if v_bet.amount < 100 then
    raise exception 'Minimum bet is 100 points to join duel queue' using errcode = 'P0001';
  end if;

  select * into v_player
  from public.players
  where id = p_player_id
  for update;

  if not found then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  v_available := v_player.points_balance - v_player.points_in_escrow;
  if v_available < v_duel.stake_amount then
    raise exception 'Insufficient available points to reserve duel stake' using errcode = 'P0009';
  end if;

  update public.players
  set points_in_escrow = points_in_escrow + v_duel.stake_amount
  where id = p_player_id;

  insert into public.duel_queue (duel_id, player_id, bet_id, status)
  values (p_duel_id, p_player_id, p_bet_id, 'waiting');

  if v_duel.status = 'created' then
    update public.duels
    set status = 'queued'
    where id = p_duel_id
    returning * into v_duel;
  end if;

  perform private.log_duel_event(
    v_duel.id,
    v_duel.prediction_id,
    'duel_joined',
    jsonb_build_object(
      'player_id', p_player_id,
      'bet_id', p_bet_id,
      'stake_amount', v_duel.stake_amount
    )
  );

  select * into v_duel
  from public.duels
  where id = p_duel_id;

  return v_duel;
end;
$$;

create or replace function private.process_duels_on_prediction_lock(
  p_prediction_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_prediction public.predictions%rowtype;
  v_duel public.duels%rowtype;
  v_challenger_bet public.bets%rowtype;
  v_candidate record;
  v_refund_candidate record;
  v_matched_queue_id uuid;
  v_matched_player_id uuid;
  v_matched_bet_id uuid;
  v_refunded_count integer;
  v_matched_count integer := 0;
  v_expired_count integer := 0;
begin
  select * into v_prediction
  from public.predictions
  where id = p_prediction_id
  for update;

  if not found then
    raise exception 'Prediction not found' using errcode = 'P0006';
  end if;

  if v_prediction.status <> 'locked' then
    raise exception 'Prediction must be locked before duel matching' using errcode = 'P0001';
  end if;

  for v_duel in
    select *
    from public.duels
    where prediction_id = p_prediction_id
      and status in ('created', 'queued')
    order by created_at asc
    for update skip locked
  loop
    select * into v_challenger_bet
    from public.bets
    where id = v_duel.challenger_bet_id
    for update;

    if not found then
      raise exception 'Challenger bet not found' using errcode = 'P0006';
    end if;

    v_matched_queue_id := null;
    v_matched_player_id := null;
    v_matched_bet_id := null;

    for v_candidate in
      select
        dq.id as queue_id,
        dq.player_id,
        dq.bet_id,
        b.option_id,
        b.amount
      from public.duel_queue dq
      join public.bets b on b.id = dq.bet_id
      where dq.duel_id = v_duel.id
        and dq.status = 'waiting'
      order by dq.created_at asc, dq.id asc
      for update of dq, b skip locked
    loop
      if v_candidate.option_id = v_challenger_bet.option_id then
        continue;
      end if;

      v_matched_queue_id := v_candidate.queue_id;
      v_matched_player_id := v_candidate.player_id;
      v_matched_bet_id := v_candidate.bet_id;
      exit;
    end loop;

    if v_matched_player_id is not null then
      update public.duels
      set matched_opponent_player_id = v_matched_player_id,
          matched_opponent_bet_id = v_matched_bet_id,
          status = 'matched',
          matched_at = now()
      where id = v_duel.id
      returning * into v_duel;

      update public.duel_queue
      set status = 'matched'
      where id = v_matched_queue_id
        and status = 'waiting';

      v_refunded_count := 0;
      for v_refund_candidate in
        select dq.id, dq.player_id
        from public.duel_queue dq
        where dq.duel_id = v_duel.id
          and dq.id <> v_matched_queue_id
          and dq.status = 'waiting'
        for update of dq skip locked
      loop
        update public.players
        set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
        where id = v_refund_candidate.player_id;

        update public.duel_queue
        set status = 'refunded'
        where id = v_refund_candidate.id
          and status = 'waiting';

        v_refunded_count := v_refunded_count + 1;
      end loop;

      perform private.log_duel_event(
        v_duel.id,
        v_duel.prediction_id,
        'duel_matched',
        jsonb_build_object(
          'challenger_player_id', v_duel.challenger_player_id,
          'opponent_player_id', v_duel.matched_opponent_player_id,
          'stake_amount', v_duel.stake_amount,
          'queued_refunded_count', v_refunded_count
        )
      );

      v_matched_count := v_matched_count + 1;
    else
      update public.players
      set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
      where id = v_duel.challenger_player_id;

      v_refunded_count := 0;
      for v_refund_candidate in
        select dq.id, dq.player_id
        from public.duel_queue dq
        where dq.duel_id = v_duel.id
          and dq.status = 'waiting'
        for update of dq skip locked
      loop
        update public.players
        set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
        where id = v_refund_candidate.player_id;

        update public.duel_queue
        set status = 'refunded'
        where id = v_refund_candidate.id
          and status = 'waiting';

        v_refunded_count := v_refunded_count + 1;
      end loop;

      update public.duels
      set status = 'expired',
          resolved_at = now(),
          matched_opponent_player_id = null,
          matched_opponent_bet_id = null,
          matched_at = null
      where id = v_duel.id
      returning * into v_duel;

      perform private.log_duel_event(
        v_duel.id,
        v_duel.prediction_id,
        'duel_cancelled',
        jsonb_build_object(
          'reason', 'no_opponent_with_opposite_pick_on_lock',
          'final_status', 'expired',
          'challenger_refunded', true,
          'queued_refunded_count', v_refunded_count,
          'fee_refunded', false
        )
      );

      v_expired_count := v_expired_count + 1;
    end if;
  end loop;

  return json_build_object(
    'prediction_id', p_prediction_id,
    'matched_duels', v_matched_count,
    'expired_duels', v_expired_count
  );
end;
$$;

create or replace function public.cancel_duel(
  p_duel_id uuid,
  p_player_id uuid
)
returns public.duels
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_auth_player_id uuid;
  v_duel public.duels%rowtype;
  v_refund_candidate record;
begin
  v_auth_player_id := private.get_player_id_from_auth();

  if v_auth_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if v_auth_player_id <> p_player_id then
    raise exception 'You can only cancel your own duel' using errcode = 'P0013';
  end if;

  select * into v_duel
  from public.duels
  where id = p_duel_id
  for update;

  if not found then
    raise exception 'Duel not found' using errcode = 'P0006';
  end if;

  if v_duel.status in ('cancelled', 'resolved', 'expired') then
    return v_duel;
  end if;

  if v_duel.challenger_player_id <> p_player_id then
    raise exception 'Only challenger can cancel this duel' using errcode = 'P0013';
  end if;

  if v_duel.status = 'matched' or v_duel.matched_opponent_player_id is not null then
    raise exception 'Cannot cancel duel after opponent is matched' using errcode = 'P0001';
  end if;

  update public.players
  set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
  where id = v_duel.challenger_player_id;

  for v_refund_candidate in
    select dq.id, dq.player_id
    from public.duel_queue dq
    where dq.duel_id = p_duel_id
      and dq.status = 'waiting'
    for update of dq skip locked
  loop
    update public.players
    set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
    where id = v_refund_candidate.player_id;

    update public.duel_queue
    set status = 'refunded'
    where id = v_refund_candidate.id
      and status = 'waiting';
  end loop;

  update public.duels
  set status = 'cancelled',
      resolved_at = now()
  where id = p_duel_id
  returning * into v_duel;

  perform private.log_duel_event(
    v_duel.id,
    v_duel.prediction_id,
    'duel_cancelled',
    jsonb_build_object(
      'cancelled_by', p_player_id,
      'fee_refunded', false
    )
  );

  return v_duel;
end;
$$;

create or replace function public.resolve_duels_for_prediction(
  p_prediction_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_prediction public.predictions%rowtype;
  v_duel public.duels%rowtype;
  v_queue record;
  v_challenger_bet public.bets%rowtype;
  v_opponent_bet public.bets%rowtype;
  v_winner_player_id uuid;
  v_loser_player_id uuid;
  v_resolved_count integer := 0;
  v_cancelled_count integer := 0;
  v_cancel_status text;
begin
  select * into v_prediction
  from public.predictions
  where id = p_prediction_id
  for update;

  if not found then
    raise exception 'Prediction not found' using errcode = 'P0006';
  end if;

  if v_prediction.status not in ('revealed', 'no_result', 'cancelled') then
    raise exception 'Prediction must be resolved before settling duels' using errcode = 'P0001';
  end if;

  for v_duel in
    select *
    from public.duels
    where prediction_id = p_prediction_id
      and status = 'matched'
    order by created_at asc
    for update skip locked
  loop
    if v_prediction.status = 'revealed' and v_prediction.winning_option_id is not null then
      select * into v_challenger_bet
      from public.bets
      where id = v_duel.challenger_bet_id
      for update;

      select * into v_opponent_bet
      from public.bets
      where id = v_duel.matched_opponent_bet_id
      for update;

      if v_challenger_bet.option_id = v_prediction.winning_option_id then
        v_winner_player_id := v_duel.challenger_player_id;
        v_loser_player_id := v_duel.matched_opponent_player_id;
      else
        v_winner_player_id := v_duel.matched_opponent_player_id;
        v_loser_player_id := v_duel.challenger_player_id;
      end if;

      update public.players
      set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0),
          points_balance = points_balance + v_duel.stake_amount
      where id = v_winner_player_id;

      update public.players
      set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0),
          points_balance = points_balance - v_duel.stake_amount
      where id = v_loser_player_id;

      update public.duels
      set status = 'resolved',
          resolved_at = now()
      where id = v_duel.id
      returning * into v_duel;

      perform private.log_duel_event(
        v_duel.id,
        v_duel.prediction_id,
        'duel_resolved',
        jsonb_build_object(
          'winner_player_id', v_winner_player_id,
          'loser_player_id', v_loser_player_id,
          'winning_option_id', v_prediction.winning_option_id,
          'stake_amount', v_duel.stake_amount
        )
      );

      v_resolved_count := v_resolved_count + 1;
    else
      update public.players
      set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
      where id in (v_duel.challenger_player_id, v_duel.matched_opponent_player_id);

      update public.duels
      set status = 'cancelled',
          resolved_at = now()
      where id = v_duel.id
      returning * into v_duel;

      perform private.log_duel_event(
        v_duel.id,
        v_duel.prediction_id,
        'duel_cancelled',
        jsonb_build_object(
          'reason', 'parent_prediction_not_revealed',
          'fee_refunded', false
        )
      );

      v_cancelled_count := v_cancelled_count + 1;
    end if;
  end loop;

  if v_prediction.status = 'revealed' then
    v_cancel_status := 'expired';
  else
    v_cancel_status := 'cancelled';
  end if;

  for v_duel in
    select *
    from public.duels
    where prediction_id = p_prediction_id
      and status in ('created', 'queued')
    order by created_at asc
    for update skip locked
  loop
    update public.players
    set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
    where id = v_duel.challenger_player_id;

    for v_queue in
      select dq.id, dq.player_id
      from public.duel_queue dq
      where dq.duel_id = v_duel.id
        and dq.status = 'waiting'
      for update of dq skip locked
    loop
      update public.players
      set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
      where id = v_queue.player_id;

      update public.duel_queue
      set status = 'refunded'
      where id = v_queue.id
        and status = 'waiting';
    end loop;

    update public.duels
    set status = v_cancel_status,
        resolved_at = now()
    where id = v_duel.id
    returning * into v_duel;

    perform private.log_duel_event(
      v_duel.id,
      v_duel.prediction_id,
      'duel_cancelled',
      jsonb_build_object(
        'reason', 'unmatched_before_prediction_resolution',
        'final_status', v_cancel_status,
        'fee_refunded', false
      )
    );

    v_cancelled_count := v_cancelled_count + 1;
  end loop;

  return json_build_object(
    'prediction_id', p_prediction_id,
    'resolved_duels', v_resolved_count,
    'cancelled_or_expired_duels', v_cancelled_count
  );
end;
$$;

create or replace function public.cancel_duel_queue(
  p_duel_id uuid,
  p_player_id uuid
)
returns public.duels
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_auth_player_id uuid;
  v_duel public.duels%rowtype;
  v_queue public.duel_queue%rowtype;
  v_prediction_status text;
begin
  v_auth_player_id := private.get_player_id_from_auth();

  if v_auth_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if v_auth_player_id <> p_player_id then
    raise exception 'You can only leave your own duel queue entry' using errcode = 'P0013';
  end if;

  select * into v_duel
  from public.duels
  where id = p_duel_id
  for update;

  if not found then
    raise exception 'Duel not found' using errcode = 'P0006';
  end if;

  if v_duel.status not in ('created', 'queued') or v_duel.matched_opponent_player_id is not null then
    raise exception 'Duel queue can only be cancelled before a match is made' using errcode = 'P0001';
  end if;

  select p.status into v_prediction_status
  from public.predictions p
  where p.id = v_duel.prediction_id
  for update;

  if v_prediction_status is distinct from 'draft' then
    raise exception 'Prediction is no longer live for queue cancellation' using errcode = 'P0001';
  end if;

  select * into v_queue
  from public.duel_queue dq
  where dq.duel_id = p_duel_id
    and dq.player_id = p_player_id
    and dq.status = 'waiting'
  order by dq.created_at desc, dq.id desc
  limit 1
  for update;

  if not found then
    raise exception 'No waiting queue entry found to cancel' using errcode = 'P0006';
  end if;

  update public.players
  set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
  where id = p_player_id;

  update public.duel_queue
  set status = 'cancelled'
  where id = v_queue.id
    and status = 'waiting';

  if v_duel.status = 'queued'
     and not exists (
       select 1
       from public.duel_queue dq
       where dq.duel_id = p_duel_id
         and dq.status = 'waiting'
     ) then
    update public.duels
    set status = 'created'
    where id = p_duel_id
    returning * into v_duel;
  else
    select * into v_duel
    from public.duels
    where id = p_duel_id;
  end if;

  perform private.log_duel_event(
    v_duel.id,
    v_duel.prediction_id,
    'duel_queue_cancelled',
    jsonb_build_object(
      'player_id', p_player_id,
      'queue_entry_id', v_queue.id,
      'stake_amount', v_duel.stake_amount
    )
  );

  return v_duel;
end;
$$;

create or replace function private.get_duel_view_model(
  p_duel_id uuid,
  p_current_player_id uuid default private.get_player_id_from_auth()
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_result jsonb;
begin
  with duel_base as (
    select
      d.id,
      d.status,
      d.prediction_id,
      d.challenger_player_id,
      d.matched_opponent_player_id,
      d.stake_amount,
      d.fee_amount,
      d.created_at,
      d.matched_at,
      d.resolved_at,
      p.winning_option_id,
      cb.option_id as challenger_option_id,
      ob.option_id as opponent_option_id,
      cp.username as challenger_username,
      op.username as opponent_username
    from public.duels d
    join public.predictions p on p.id = d.prediction_id
    join public.bets cb on cb.id = d.challenger_bet_id
    left join public.bets ob on ob.id = d.matched_opponent_bet_id
    join public.players cp on cp.id = d.challenger_player_id
    left join public.players op on op.id = d.matched_opponent_player_id
    where d.id = p_duel_id
  ),
  queue_data as (
    select
      count(*) filter (where dq.status = 'waiting')::int as queue_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'player', jsonb_build_object(
              'id', pl.id,
              'username', pl.username
            ),
            'status', dq.status,
            'joinedAt', dq.created_at
          )
          order by dq.created_at asc, dq.id asc
        ),
        '[]'::jsonb
      ) as queue_entries,
      coalesce(
        bool_or(
          dq.player_id = p_current_player_id
          and dq.status = 'waiting'
        ),
        false
      ) as current_player_queued
    from public.duel_queue dq
    join public.players pl on pl.id = dq.player_id
    where dq.duel_id = p_duel_id
  ),
  winner_data as (
    select
      case
        when db.status = 'resolved'
          and db.winning_option_id is not null
          and db.matched_opponent_player_id is not null
        then
          case
            when db.challenger_option_id = db.winning_option_id then db.challenger_player_id
            when db.opponent_option_id = db.winning_option_id then db.matched_opponent_player_id
            else null
          end
        else null
      end as winner_player_id
    from duel_base db
  ),
  rivalry_data as (
    select
      count(*)::int as total_duels,
      count(*) filter (where winner_id = p_current_player_id)::int as wins,
      count(*) filter (where winner_id = opponent_context.v_opponent_id)::int as losses,
      coalesce(
        sum(
          case
            when winner_id = p_current_player_id then stake_amount
            when winner_id = opponent_context.v_opponent_id then -stake_amount
            else 0
          end
        ),
        0
      )::int as net_points
    from (
      select
        rd.stake_amount,
        case
          when rcb.option_id = rp.winning_option_id then rd.challenger_player_id
          when rob.option_id = rp.winning_option_id then rd.matched_opponent_player_id
          else null
        end as winner_id
      from public.duels rd
      join public.predictions rp on rp.id = rd.prediction_id
      join public.bets rcb on rcb.id = rd.challenger_bet_id
      left join public.bets rob on rob.id = rd.matched_opponent_bet_id
      cross join lateral (
        select
          case
            when db.challenger_player_id = p_current_player_id then db.matched_opponent_player_id
            when db.matched_opponent_player_id = p_current_player_id then db.challenger_player_id
            else null
          end as v_opponent_id
        from duel_base db
      ) pair
      where rd.status = 'resolved'
        and rp.winning_option_id is not null
        and pair.v_opponent_id is not null
        and (
          (rd.challenger_player_id = p_current_player_id and rd.matched_opponent_player_id = pair.v_opponent_id)
          or
          (rd.challenger_player_id = pair.v_opponent_id and rd.matched_opponent_player_id = p_current_player_id)
        )
    ) rivalry_source
    cross join lateral (
      select
        case
          when db.challenger_player_id = p_current_player_id then db.matched_opponent_player_id
          when db.matched_opponent_player_id = p_current_player_id then db.challenger_player_id
          else null
        end as v_opponent_id
      from duel_base db
    ) opponent_context
  )
  select jsonb_build_object(
    'id', db.id,
    'status', db.status,
    'challenger', jsonb_build_object(
      'id', db.challenger_player_id,
      'username', db.challenger_username
    ),
    'opponent', case
      when db.matched_opponent_player_id is null then null
      else jsonb_build_object(
        'id', db.matched_opponent_player_id,
        'username', db.opponent_username
      )
    end,
    'stakeAmount', db.stake_amount,
    'feeAmount', db.fee_amount,
    'totalPot', (db.stake_amount * 2),
    'queueCount', q.queue_count,
    'queue', q.queue_entries,
    'currentPlayerState',
      case
        when p_current_player_id is null then 'none'
        when db.status = 'resolved'
          and w.winner_player_id is not null
          and (p_current_player_id = db.challenger_player_id or p_current_player_id = db.matched_opponent_player_id)
        then case
          when w.winner_player_id = p_current_player_id then 'winner'
          else 'loser'
        end
        when db.status = 'matched'
          and (p_current_player_id = db.challenger_player_id or p_current_player_id = db.matched_opponent_player_id)
        then 'matched'
        when q.current_player_queued then 'queued'
        when p_current_player_id = db.challenger_player_id then 'creator'
        else 'none'
      end,
    'currentPlayerQueued', q.current_player_queued,
    'totalReserved',
      case
        when db.status in ('created', 'queued') then db.stake_amount * (q.queue_count + 1)
        when db.status = 'matched' then db.stake_amount * 2
        else 0
      end,
    'rivalry',
      case
        when p_current_player_id is null then null
        when db.matched_opponent_player_id is null then null
        when p_current_player_id not in (db.challenger_player_id, db.matched_opponent_player_id) then null
        else (
          select jsonb_build_object(
            'totalDuels', rd.total_duels,
            'wins', rd.wins,
            'losses', rd.losses,
            'netPoints', rd.net_points
          )
          from rivalry_data rd
        )
      end,
    'winner',
      case
        when w.winner_player_id is null then null
        else (
          select jsonb_build_object('id', p.id, 'username', p.username)
          from public.players p
          where p.id = w.winner_player_id
        )
      end,
    'payout',
      case
        when db.status = 'resolved' and w.winner_player_id is not null then db.stake_amount * 2
        else null
      end,
    'createdAt', db.created_at,
    'matchedAt', db.matched_at,
    'resolvedAt', db.resolved_at
  )
  into v_result
  from duel_base db
  cross join queue_data q
  cross join winner_data w;

  return v_result;
end;
$$;

create or replace function public.get_prediction_duel_summary(
  p_prediction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_auth_player_id uuid;
  v_result jsonb;
begin
  v_auth_player_id := private.get_player_id_from_auth();

  with queue_by_duel as (
    select dq.duel_id, count(*) filter (where dq.status = 'waiting')::int as queue_count
    from public.duel_queue dq
    group by dq.duel_id
  ),
  duel_rows as (
    select
      d.id,
      d.status,
      d.stake_amount,
      d.challenger_player_id,
      d.matched_opponent_player_id,
      coalesce(q.queue_count, 0) as queue_count
    from public.duels d
    left join queue_by_duel q on q.duel_id = d.id
    where d.prediction_id = p_prediction_id and d.status in ('created', 'queued', 'matched', 'resolved')
  ),
  participants as (
    select challenger_player_id as player_id from duel_rows
    union
    select matched_opponent_player_id from duel_rows where matched_opponent_player_id is not null
    union
    select dq.player_id
    from public.duel_queue dq
    join public.duels d on d.id = dq.duel_id
    where d.prediction_id = p_prediction_id
  ),
  current_player_active_created as (
    select d.id
    from public.duels d
    where d.prediction_id = p_prediction_id
      and d.challenger_player_id = v_auth_player_id
      and d.status in ('created', 'queued', 'matched')
    order by d.created_at desc
    limit 1
  ),
  current_player_queue as (
    select count(*)::int as queued_count
    from public.duel_queue dq
    join public.duels d on d.id = dq.duel_id
    where d.prediction_id = p_prediction_id
      and dq.player_id = v_auth_player_id
      and dq.status = 'waiting'
      and d.status in ('created', 'queued', 'matched')
  ),
  current_player_active_participation as (
    select exists (
      select 1
      from public.duels d
      where d.prediction_id = p_prediction_id
        and d.status in ('created', 'queued', 'matched')
        and (
          d.challenger_player_id = v_auth_player_id
          or d.matched_opponent_player_id = v_auth_player_id
          or exists (
            select 1
            from public.duel_queue dq
            where dq.duel_id = d.id
              and dq.player_id = v_auth_player_id
              and dq.status in ('waiting', 'matched')
          )
        )
    ) as has_active_participation
  ),
  current_player_qualifying_bet as (
    select exists (
      select 1
      from public.bets b
      where b.prediction_id = p_prediction_id
        and b.player_id = v_auth_player_id
        and b.amount >= 100
    ) as has_qualifying_bet
  ),
  prediction_phase as (
    select p.status
    from public.predictions p
    where p.id = p_prediction_id
  )
  select jsonb_build_object(
    'totalDuels', count(*)::int,
    'activeDuels', count(*) filter (where dr.status in ('created', 'queued'))::int,
    'matchedDuels', count(*) filter (where dr.status = 'matched')::int,
    'resolvedDuels', count(*) filter (where dr.status in ('resolved'))::int,
    'totalStake', coalesce(sum(dr.stake_amount), 0)::int,
    'totalEscrow', coalesce(sum(
      case
        when dr.status in ('created', 'queued') then dr.stake_amount * (dr.queue_count + 1)
        when dr.status = 'matched' then dr.stake_amount * 2
        else 0
      end
    ), 0)::int,
    'largestStake', max(dr.stake_amount),
    'medianStake', percentile_cont(0.5) within group (order by dr.stake_amount),
    'uniqueParticipants', (select count(*)::int from participants),
    'queueEntries', (
      select count(*)::int
      from public.duel_queue dq
      join public.duels d on d.id = dq.duel_id
      where d.prediction_id = p_prediction_id
        and dq.status = 'waiting'
    ),
    'currentPlayerHasCreatedDuel', exists(select 1 from current_player_active_created),
    'currentPlayerCreatedDuelId', (select id from current_player_active_created),
    'currentPlayerQueuedCount', (select queued_count from current_player_queue),
    'currentPlayerCanCreate',
      (
        v_auth_player_id is not null
        and (select status from prediction_phase) = 'draft'
        and (select has_qualifying_bet from current_player_qualifying_bet)
        and not (select has_active_participation from current_player_active_participation)
      )
  )
  into v_result
  from duel_rows dr;

  return coalesce(
    v_result,
    jsonb_build_object(
      'totalDuels', 0,
      'activeDuels', 0,
      'matchedDuels', 0,
      'resolvedDuels', 0,
      'totalStake', 0,
      'totalEscrow', 0,
      'largestStake', null,
      'medianStake', null,
      'uniqueParticipants', 0,
      'queueEntries', 0,
      'currentPlayerHasCreatedDuel', false,
      'currentPlayerCreatedDuelId', null,
      'currentPlayerQueuedCount', 0,
      'currentPlayerCanCreate', false
    )
  );
end;
$$;

create or replace function public.cancel_duel_queue_view(
  p_duel_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_auth_player_id uuid;
  v_duel public.duels%rowtype;
begin
  v_auth_player_id := private.get_player_id_from_auth();

  select * into v_duel
  from public.cancel_duel_queue(
    p_duel_id,
    p_player_id
  );

  return private.get_duel_view_model(v_duel.id, v_auth_player_id);
end;
$$;

grant execute on function public.cancel_duel_queue(uuid, uuid) to authenticated;
grant execute on function public.cancel_duel_queue_view(uuid, uuid) to authenticated;

revoke all on function private.enforce_duel_queue_status_transition() from public;
revoke all on function private.enforce_duel_queue_status_transition() from authenticated;
