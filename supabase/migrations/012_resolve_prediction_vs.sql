-- ============================================================
-- Migration: 004_resolve_and_payout_v2
-- Description: Prediction resolution with per-loser independent
--              matching against the winning pool.
--
-- PAYOUT MODEL:
--   Each loser is evaluated independently against the full
--   winning pool (sum of all winning bets).
--
--   For each loser:
--     IF loser_bet >= total_winner_capacity:
--       → every winner gets exactly their full stake from this loser
--       → loser refund = loser_bet - total_winner_capacity
--     IF loser_bet < total_winner_capacity:
--       → each winner gets floor(their_bet / total_winner_capacity * loser_bet)
--       → loser refund = 0
--
--   Each losing option's losers are processed independently.
--   A winner's gain accumulates across all losers on all losing options.
--
-- VERIFIED EXAMPLE:
--   Winner A: 10pts, Winner D: 50pts → total_winner_cap = 60pts
--
--   Loser B: 100pts  (100 >= 60 → full match)
--     A gets 10, D gets 50. B refund: 40pts.
--
--   Loser C:  30pts  (30 < 60 → proportional)
--     A gets floor(10/60 * 30) = 5pts
--     D gets floor(50/60 * 30) = 25pts. C refund: 0pts.
--
--   Loser E:  80pts on a different option  (80 >= 60 → full match)
--     A gets 10, D gets 50. E refund: 20pts.
--
--   Final:
--     A:  10 (stake) + 10 + 5  + 10 = 35pts
--     D:  50 (stake) + 50 + 25 + 50 = 175pts
--     B refund: 40pts | C refund: 0pts | E refund: 20pts
-- ============================================================


-- ============================================================
-- INTERNAL: full refund for cancel / no_result outcomes
-- Releases escrow only — balance untouched (funds were escrowed
-- not deducted at bet placement time).
-- ============================================================
create or replace function private.refund_all_bets_v2(p_prediction_id uuid)
returns void
language plpgsql
as $$
declare
  v_bet public.bets%rowtype;
begin
  for v_bet in
    select * from public.bets
    where prediction_id = p_prediction_id
  loop
    update public.players
    set points_in_escrow = points_in_escrow - v_bet.amount
    where id = v_bet.player_id;

    update public.bets
    set payout = v_bet.amount   -- full refund = original stake
    where id = v_bet.id;
  end loop;
end;
$$;


-- ============================================================
-- RPC: resolve_prediction
--
-- p_outcome:
--   'win'       — requires p_winning_option_id, triggers matching
--   'no_result' — full refund, no matching
--   'cancel'    — full refund, no matching
--
-- Auto-falls back to no_result + full refund when:
--   • Only one option received any bets
--   • Nobody bet on the declared winning option
-- ============================================================
create or replace function public.resolve_prediction_v2(
  p_player_token      text,
  p_prediction_id     uuid,
  p_room_id           uuid,
  p_outcome           text,
  p_winning_option_id uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_room              public.rooms%rowtype;
  v_prediction        public.predictions%rowtype;
  v_winning_option    public.prediction_options%rowtype;

  v_total_winner_cap  numeric;   -- sum of all winning bets; fixed for entire resolution

  v_loser             record;    -- one losing bet row
  v_winner            record;    -- one winning bet row

  v_winner_gain       integer;   -- gain one winner receives from one loser
  v_loser_refund      integer;   -- unmatched remainder returned to one loser

  v_final_payout      integer;   -- stake + total accumulated gains for a winner
  v_winners_count     integer := 0;
  v_losers_count      integer := 0;
  v_multiple_sides    boolean;
begin

  -- ── Verify organizer ─────────────────────────────────────
  select * into v_room
  from public.room_members
  where room_id = p_room_id
    and player_id = (select id from public.players where token = p_player_token)
    and is_organizer;

  if not found then
    raise exception 'Invalid organizer token' using errcode = 'P0004';
  end if;

  -- ── Prediction must be locked ────────────────────────────
  select * into v_prediction
  from public.predictions
  where id      = p_prediction_id
    and room_id = v_room.id
    and status  = 'locked';

  if not found then
    raise exception 'Prediction not found or not in locked phase'
    using errcode = 'P0006';
  end if;

  -- ────────────────────────────────────────────────────────
  -- CANCEL / NO RESULT — full refund, skip all matching
  -- ────────────────────────────────────────────────────────
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

  -- ────────────────────────────────────────────────────────
  -- WIN — validate declared winning option
  -- ────────────────────────────────────────────────────────
  if p_outcome <> 'win' then
    raise exception 'Invalid outcome. Must be win, no_result, or cancel.'
    using errcode = 'P0001';
  end if;

  if p_winning_option_id is null then
    raise exception 'p_winning_option_id is required for a win outcome'
    using errcode = 'P0001';
  end if;

  select * into v_winning_option
  from public.prediction_options
  where id            = p_winning_option_id
    and prediction_id = p_prediction_id;

  if not found then
    raise exception 'Winning option does not belong to this prediction'
    using errcode = 'P0008';
  end if;

  -- ── Edge: only one option received bets → no_result ──────
  select count(distinct option_id) > 1 into v_multiple_sides
  from public.bets
  where prediction_id = p_prediction_id;

  if not v_multiple_sides then
    perform private.refund_all_bets(p_prediction_id);
    update public.predictions set status = 'no_result', resolved_at = now()
    where id = p_prediction_id;
    return json_build_object(
      'resolved', true, 'outcome', 'no_result',
      'reason',   'Only one option had bets — all refunded', 'refunded', true
    );
  end if;

  -- ── Edge: nobody bet on winning option → no_result ───────
  if v_winning_option.total_bet = 0 then
    perform private.refund_all_bets(p_prediction_id);
    update public.predictions set status = 'no_result', resolved_at = now()
    where id = p_prediction_id;
    return json_build_object(
      'resolved', true, 'outcome', 'no_result',
      'reason',   'Nobody bet on the winning option — all refunded', 'refunded', true
    );
  end if;

  -- ────────────────────────────────────────────────────────
  -- PER-LOSER INDEPENDENT MATCHING
  -- ────────────────────────────────────────────────────────

  -- Total winner capacity: fixed reference point for all loser calculations
  select sum(amount)::numeric into v_total_winner_cap
  from public.bets
  where prediction_id = p_prediction_id
    and option_id     = p_winning_option_id;

  -- Accumulate each winner's gains across all losers.
  -- Dropped automatically at end of transaction.
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

  -- ── Iterate every losing bet independently ────────────────
  for v_loser in
    select b.id        as bet_id,
           b.player_id,
           b.amount
    from public.bets b
    where b.prediction_id = p_prediction_id
      and b.option_id    <> p_winning_option_id
  loop

    if v_loser.amount::numeric >= v_total_winner_cap then
      -- ── Loser can cover everyone in full ──────────────────
      -- Each winner receives exactly their bet_amount from this loser.
      -- Loser gets back whatever was left unmatched.

      v_loser_refund := v_loser.amount - v_total_winner_cap::integer;

      for v_winner in
        select player_id, bet_amount from _winner_gains
      loop
        -- Winner gains their full stake from this loser
        update _winner_gains
        set total_gain = total_gain + v_winner.bet_amount
        where player_id = v_winner.player_id;
      end loop;

    else
      -- ── Loser cannot cover everyone → proportional ────────
      -- Each winner gets floor(their_bet / total_winner_cap * loser_bet).
      -- Loser loses everything (refund = 0).

      v_loser_refund := 0;

      for v_winner in
        select player_id, bet_amount from _winner_gains
      loop
        v_winner_gain := floor(
          (v_winner.bet_amount::numeric / v_total_winner_cap)
          * v_loser.amount::numeric
        );

        update _winner_gains
        set total_gain = total_gain + v_winner_gain
        where player_id = v_winner.player_id;
      end loop;

    end if;

    -- Apply loser outcome:
    --   1. Release the full escrow reservation
    --   2. Deduct the full bet from balance (the actual loss)
    --   3. Add back any unmatched refund
    -- Net: balance -= (v_loser.amount - v_loser_refund)
    -- e.g. C bet 30, refund 0:   balance = balance - 30 + 0  → loses 30 ✓
    -- e.g. B bet 100, refund 40: balance = balance - 100 + 40 → loses 60 ✓
    update public.players
    set points_in_escrow = points_in_escrow - v_loser.amount,
        points_balance   = points_balance   - v_loser.amount + v_loser_refund
    where id = v_loser.player_id;

    -- payout on a losing bet = what they get back (0 if fully matched)
    update public.bets
    set payout = v_loser_refund
    where id = v_loser.bet_id;

    v_losers_count := v_losers_count + 1;
  end loop;

  -- ── Apply final payouts to all winners ────────────────────
  for v_winner in
    select player_id, bet_amount, total_gain
    from _winner_gains
  loop
    v_final_payout := v_winner.bet_amount + v_winner.total_gain;

    -- Release escrow + credit full payout to balance
    -- Increment total_won by profit only (gains, not returned stake)
    update public.players
    set points_in_escrow = points_in_escrow - v_winner.bet_amount,
        points_balance   = points_balance   + v_final_payout,
        total_won        = total_won        + v_winner.total_gain
    where id = v_winner.player_id;

    -- Per-room leaderboard: profit only
    update public.room_members
    set total_won_in_room = total_won_in_room + v_winner.total_gain
    where room_id   = v_prediction.room_id
      and player_id = v_winner.player_id;

    -- payout on a winning bet = stake + all gains
    update public.bets
    set payout = v_final_payout
    where prediction_id = p_prediction_id
      and player_id     = v_winner.player_id;

    v_winners_count := v_winners_count + 1;
  end loop;

  -- ── Mark prediction as revealed ──────────────────────────
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


-- ============================================================
-- CRON: Auto-lock predictions past their deadline
-- Requires pg_cron (Supabase Dashboard > Database > Extensions)
-- Run once manually after enabling pg_cron:
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