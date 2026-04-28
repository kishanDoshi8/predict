-- ============================================================
-- Migration: 004_resolve_and_payout
-- Description: Prediction resolution with multi-option payout.
--
-- On resolution, winnings are written to:
--   players.total_won          — global lifetime stat
--   room_members.total_won_in_room — per-room leaderboard stat
--
-- All refund paths release escrow only (points_balance already
-- holds the funds; escrow is just a reservation).
-- ============================================================

-- ============================================================
-- INTERNAL: refund all bets for a prediction
-- Releases escrow for every bettor. points_balance unchanged
-- (funds were never actually deducted, only escrowed).
-- ============================================================
create or replace function private.refund_all_bets(p_prediction_id uuid)
returns void
language plpgsql
as $$
declare
  v_bet public.bets%rowtype;
begin
  for v_bet in
    select * from public.bets where prediction_id = p_prediction_id
  loop
    -- Release escrow
    update public.players
    set points_in_escrow = points_in_escrow - v_bet.amount
    where id = v_bet.player_id;

    -- Record refund in payout column (amount returned = original bet)
    update public.bets
    set payout = v_bet.amount
    where id = v_bet.id;
  end loop;
end;
$$;

-- ============================================================
-- RPC: resolve_prediction
-- Outcomes:
--   win        — supply p_winning_option_id; triggers payout
--   no_result  — all bets refunded
--   cancel     — all bets refunded
--
-- Edge cases auto-resolved to no_result + refund:
--   - Only one option has bets
--   - Nobody bet on the winning option
-- ============================================================
create or replace function public.resolve_prediction(
  p_organizer_token   text,
  p_prediction_id     uuid,
  p_outcome           text,       -- 'win' | 'no_result' | 'cancel'
  p_winning_option_id uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_room               public.rooms%rowtype;
  v_prediction         public.predictions%rowtype;
  v_winning_option     public.prediction_options%rowtype;
  v_bet                public.bets%rowtype;
  v_total_losing_pot   integer := 0;
  v_total_winning_bet  integer := 0;
  v_payout             integer;
  v_final_status       text;
  v_multiple_sides     boolean;
  v_winners_count      integer := 0;
  v_losers_count       integer := 0;
begin
  -- Verify organizer
  select * into v_room
  from public.rooms
  where organizer_token = p_organizer_token and status = 'active';

  if not found then
    raise exception 'Invalid organizer token' using errcode = 'P0004';
  end if;

  -- Prediction must be in locked state
  select * into v_prediction
  from public.predictions
  where id = p_prediction_id
    and room_id = v_room.id
    and status = 'locked';

  if not found then
    raise exception 'Prediction not found or not in locked phase' using errcode = 'P0006';
  end if;

  -- -------------------------------------------------------
  -- NO RESULT or CANCEL — refund everyone and close
  -- -------------------------------------------------------
  if p_outcome in ('no_result', 'cancel') then
    perform private.refund_all_bets(p_prediction_id);

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

  -- -------------------------------------------------------
  -- WIN — validate the winning option
  -- -------------------------------------------------------
  if p_outcome <> 'win' then
    raise exception 'Invalid outcome. Must be win, no_result, or cancel.' using errcode = 'P0001';
  end if;

  if p_winning_option_id is null then
    raise exception 'p_winning_option_id is required for a win outcome' using errcode = 'P0001';
  end if;

  select * into v_winning_option
  from public.prediction_options
  where id = p_winning_option_id
    and prediction_id = p_prediction_id;

  if not found then
    raise exception 'Winning option does not belong to this prediction' using errcode = 'P0008';
  end if;

  -- Edge case: only one option received bets → no_result
  select count(distinct option_id) > 1 into v_multiple_sides
  from public.bets
  where prediction_id = p_prediction_id;

  if not v_multiple_sides then
    perform private.refund_all_bets(p_prediction_id);

    update public.predictions
    set status = 'no_result', resolved_at = now()
    where id = p_prediction_id;

    return json_build_object(
      'resolved', true,
      'outcome',  'no_result',
      'reason',   'Only one side had bets — all refunded',
      'refunded', true
    );
  end if;

  -- Edge case: nobody bet on the winning option → no_result
  if v_winning_option.total_bet = 0 then
    perform private.refund_all_bets(p_prediction_id);

    update public.predictions
    set status = 'no_result', resolved_at = now()
    where id = p_prediction_id;

    return json_build_object(
      'resolved', true,
      'outcome',  'no_result',
      'reason',   'Nobody bet on the winning option — all refunded',
      'refunded', true
    );
  end if;

  -- -------------------------------------------------------
  -- Calculate pot = sum of all losing options' bets
  -- -------------------------------------------------------
  select coalesce(sum(total_bet), 0) into v_total_losing_pot
  from public.prediction_options
  where prediction_id = p_prediction_id
    and id <> p_winning_option_id;

  v_total_winning_bet := v_winning_option.total_bet;

  -- -------------------------------------------------------
  -- Distribute payouts
  -- payout = bet + floor((bet / total_winning_bet) * pot)
  -- -------------------------------------------------------
  for v_bet in
    select * from public.bets where prediction_id = p_prediction_id
  loop
    if v_bet.option_id = p_winning_option_id then
      -- Winner
      v_payout := v_bet.amount
                  + floor(
                      (v_bet.amount::numeric / v_total_winning_bet::numeric)
                      * v_total_losing_pot::numeric
                    );

      update public.bets set payout = v_payout where id = v_bet.id;

      -- Global player: release escrow + credit full payout to balance
      --                increment global total_won by profit only
      update public.players
      set points_in_escrow = points_in_escrow - v_bet.amount,
          points_balance   = points_balance   + v_payout,
          total_won        = total_won        + (v_payout - v_bet.amount)
      where id = v_bet.player_id;

      -- Per-room stat: increment total_won_in_room by profit only
      update public.room_members
      set total_won_in_room = total_won_in_room + (v_payout - v_bet.amount)
      where room_id  = v_prediction.room_id
        and player_id = v_bet.player_id;

      v_winners_count := v_winners_count + 1;

    else
      -- Loser — bet was escrowed at placement time (balance already reduced)
      -- Just release the escrow reservation; balance stays as-is (they lost)
      update public.bets set payout = 0 where id = v_bet.id;

      update public.players
      set points_in_escrow = points_in_escrow - v_bet.amount
      where id = v_bet.player_id;

      v_losers_count := v_losers_count + 1;
    end if;
  end loop;

  -- Mark prediction as revealed
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
    'pot',               v_total_losing_pot,
    'winners',           v_winners_count,
    'losers',            v_losers_count
  );
end;
$$;

-- ============================================================
-- CRON: Auto-lock predictions past their deadline
-- Requires pg_cron (enable in Supabase Dashboard > Extensions)
-- Run this once manually after enabling pg_cron:
-- ============================================================

/*
  select cron.schedule(
    'auto-lock-predictions',
    '* * * * *',
    $$
      update public.predictions
      set status = 'locked'
      where status = 'draft'
        and deadline <= now();
    $$
  );
*/
