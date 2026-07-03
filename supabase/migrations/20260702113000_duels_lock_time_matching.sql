-- ============================================================
-- Migration: duels_lock_time_matching
-- Description: Move duel opponent matching from join-time to prediction lock-time.
-- ============================================================

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
  ) into v_queue_exists;

  if v_queue_exists then
    raise exception 'Player is already in this duel queue' using errcode = 'P0001';
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

--   if v_duel.stake_amount > v_bet.amount then
--     raise exception 'Duel stake cannot exceed your bet amount' using errcode = 'P0001';
--   end if;

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

  insert into public.duel_queue (duel_id, player_id, bet_id)
  values (p_duel_id, p_player_id, p_bet_id);

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
      order by dq.created_at asc, dq.id asc
      for update of dq, b skip locked
    loop
      if v_candidate.amount < v_duel.stake_amount then
        continue;
      end if;

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

      v_refunded_count := 0;
      for v_refund_candidate in
        select dq.player_id
        from public.duel_queue dq
        where dq.duel_id = v_duel.id
          and dq.id <> v_matched_queue_id
        for update of dq skip locked
      loop
        update public.players
        set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
        where id = v_refund_candidate.player_id;

        v_refunded_count := v_refunded_count + 1;
      end loop;

      delete from public.duel_queue
      where duel_id = v_duel.id;

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
        select dq.player_id
        from public.duel_queue dq
        where dq.duel_id = v_duel.id
        for update of dq skip locked
      loop
        update public.players
        set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
        where id = v_refund_candidate.player_id;

        v_refunded_count := v_refunded_count + 1;
      end loop;

      delete from public.duel_queue
      where duel_id = v_duel.id;

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

create or replace function private.on_prediction_duel_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if TG_OP = 'UPDATE'
     and OLD.status = 'draft'
     and NEW.status = 'locked' then
    perform private.process_duels_on_prediction_lock(NEW.id);
  elsif TG_OP = 'UPDATE'
     and OLD.status = 'locked'
     and NEW.status in ('revealed', 'no_result', 'cancelled') then
    perform public.resolve_duels_for_prediction(NEW.id);
  end if;

  return NEW;
end;
$$;

drop function if exists public.match_duel_queue(uuid);

revoke all on function private.process_duels_on_prediction_lock(uuid) from public;
revoke all on function private.process_duels_on_prediction_lock(uuid) from authenticated;
