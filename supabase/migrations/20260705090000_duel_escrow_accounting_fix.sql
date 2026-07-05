-- ============================================================
-- Migration: duel_escrow_accounting_fix
-- Description: Make duel escrow reservation ownership explicit and release exactly once.
-- ============================================================

create or replace function private.release_duel_escrow(
  p_player_id uuid,
  p_amount integer,
  p_context text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_updated_count integer;
begin
  if p_amount <= 0 then
    raise exception 'Duel escrow release amount must be positive' using errcode = 'P0001';
  end if;

  update public.players
  set points_in_escrow = points_in_escrow - p_amount
  where id = p_player_id
    and points_in_escrow >= p_amount;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'Duel escrow release failed for player % (%). Reservation may already be released.', p_player_id, p_context
      using errcode = 'P0001';
  end if;
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
        -- join_duel_queue owns this waiting reservation; refund it exactly once via status transition.
        update public.duel_queue
        set status = 'refunded'
        where id = v_refund_candidate.id
          and status = 'waiting';

        if found then
          perform private.release_duel_escrow(
            v_refund_candidate.player_id,
            v_duel.stake_amount,
            'process_duels_on_prediction_lock:queue_refund'
          );
          v_refunded_count := v_refunded_count + 1;
        end if;
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
      update public.duels
      set status = 'expired',
          resolved_at = now(),
          matched_opponent_player_id = null,
          matched_opponent_bet_id = null,
          matched_at = null
      where id = v_duel.id
        and status in ('created', 'queued')
      returning * into v_duel;

      if not found then
        continue;
      end if;

      -- create_duel owns challenger stake reservation until duel leaves active statuses.
      perform private.release_duel_escrow(
        v_duel.challenger_player_id,
        v_duel.stake_amount,
        'process_duels_on_prediction_lock:challenger_expired'
      );

      v_refunded_count := 0;
      for v_refund_candidate in
        select dq.id, dq.player_id
        from public.duel_queue dq
        where dq.duel_id = v_duel.id
          and dq.status = 'waiting'
        for update of dq skip locked
      loop
        -- join_duel_queue owns this waiting reservation; refund it exactly once via status transition.
        update public.duel_queue
        set status = 'refunded'
        where id = v_refund_candidate.id
          and status = 'waiting';

        if found then
          perform private.release_duel_escrow(
            v_refund_candidate.player_id,
            v_duel.stake_amount,
            'process_duels_on_prediction_lock:queue_refund_expired'
          );
          v_refunded_count := v_refunded_count + 1;
        end if;
      end loop;

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

  update public.duels
  set status = 'cancelled',
      resolved_at = now()
  where id = p_duel_id
    and status in ('created', 'queued')
  returning * into v_duel;

  if not found then
    select * into v_duel
    from public.duels
    where id = p_duel_id;
    return v_duel;
  end if;

  -- create_duel owns challenger stake reservation until duel leaves active statuses.
  perform private.release_duel_escrow(
    v_duel.challenger_player_id,
    v_duel.stake_amount,
    'cancel_duel:challenger_cancel'
  );

  for v_refund_candidate in
    select dq.id, dq.player_id
    from public.duel_queue dq
    where dq.duel_id = p_duel_id
      and dq.status = 'waiting'
    for update of dq skip locked
  loop
    -- join_duel_queue owns waiting reservations; refund each exactly once via status transition.
    update public.duel_queue
    set status = 'refunded'
    where id = v_refund_candidate.id
      and status = 'waiting';

    if found then
      perform private.release_duel_escrow(
        v_refund_candidate.player_id,
        v_duel.stake_amount,
        'cancel_duel:queue_refund'
      );
    end if;
  end loop;

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

      update public.duels
      set status = 'resolved',
          resolved_at = now()
      where id = v_duel.id
        and status = 'matched'
      returning * into v_duel;

      if not found then
        continue;
      end if;

      -- create_duel owns challenger reservation until matched duel is settled.
      perform private.release_duel_escrow(
        v_duel.challenger_player_id,
        v_duel.stake_amount,
        'resolve_duels_for_prediction:challenger_resolved'
      );
      -- join_duel_queue owns opponent reservation until matched duel is settled.
      perform private.release_duel_escrow(
        v_duel.matched_opponent_player_id,
        v_duel.stake_amount,
        'resolve_duels_for_prediction:opponent_resolved'
      );

      update public.players
      set points_balance = points_balance + v_duel.stake_amount
      where id = v_winner_player_id;

      update public.players
      set points_balance = points_balance - v_duel.stake_amount
      where id = v_loser_player_id;

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
      update public.duels
      set status = 'cancelled',
          resolved_at = now()
      where id = v_duel.id
        and status = 'matched'
      returning * into v_duel;

      if not found then
        continue;
      end if;

      -- create_duel owns challenger reservation until matched duel is settled.
      perform private.release_duel_escrow(
        v_duel.challenger_player_id,
        v_duel.stake_amount,
        'resolve_duels_for_prediction:challenger_cancelled'
      );
      -- join_duel_queue owns opponent reservation until matched duel is settled.
      perform private.release_duel_escrow(
        v_duel.matched_opponent_player_id,
        v_duel.stake_amount,
        'resolve_duels_for_prediction:opponent_cancelled'
      );

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
    update public.duels
    set status = v_cancel_status,
        resolved_at = now()
    where id = v_duel.id
      and status in ('created', 'queued')
    returning * into v_duel;

    if not found then
      continue;
    end if;

    -- create_duel owns challenger reservation until duel leaves active statuses.
    perform private.release_duel_escrow(
      v_duel.challenger_player_id,
      v_duel.stake_amount,
      'resolve_duels_for_prediction:challenger_unmatched'
    );

    for v_queue in
      select dq.id, dq.player_id
      from public.duel_queue dq
      where dq.duel_id = v_duel.id
        and dq.status = 'waiting'
      for update of dq skip locked
    loop
      -- join_duel_queue owns waiting reservations; refund each exactly once via status transition.
      update public.duel_queue
      set status = 'refunded'
      where id = v_queue.id
        and status = 'waiting';

      if found then
        perform private.release_duel_escrow(
          v_queue.player_id,
          v_duel.stake_amount,
          'resolve_duels_for_prediction:queue_unmatched'
        );
      end if;
    end loop;

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

  -- join_duel_queue owns this waiting reservation; cancel it exactly once via status transition.
  update public.duel_queue
  set status = 'cancelled'
  where id = v_queue.id
    and status = 'waiting';

  if not found then
    raise exception 'Queue entry is no longer cancellable' using errcode = 'P0001';
  end if;

  perform private.release_duel_escrow(
    p_player_id,
    v_duel.stake_amount,
    'cancel_duel_queue:player_cancel'
  );

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

revoke all on function private.release_duel_escrow(uuid, integer, text) from public;
revoke all on function private.release_duel_escrow(uuid, integer, text) from authenticated;
