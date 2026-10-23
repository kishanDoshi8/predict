-- ============================================================
-- Migration: security_hardening
-- Description: Make the scoreboard trustworthy.
--   1. No direct table writes from the API roles (players could edit their own points).
--   2. Table reads limited to members of the room; nothing readable while logged out.
--   3. RPC access is an explicit allowlist (internal stats/rating functions were callable).
--   4. Row locks in the points-moving RPCs so concurrent calls can't overspend or double-pay.
--   5. A database rule that escrowed points never exceed the balance.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Remove dead token-based resolve functions (organizer tokens were removed in 006)
-- ------------------------------------------------------------
drop function if exists public.resolve_prediction(text, uuid, text, uuid);
drop function if exists public.resolve_prediction_v2(text, uuid, text, uuid);

-- ------------------------------------------------------------
-- 2. Table privileges: logged-out users get nothing, logged-in users read only
-- ------------------------------------------------------------
drop policy if exists "players_self_update" on public.players;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from authenticated;

-- Column-level only: player_token, user_id and last_visited_room_id stay private.
revoke select on public.players from authenticated;
grant select (id, username, points_balance, points_in_escrow, total_won, current_streak, longest_streak, last_claim_at, created_at) on public.players to authenticated;

-- ------------------------------------------------------------
-- 3. Points invariant. NOT VALID so existing rows don't block the migration;
--    new writes are checked. Validate once existing data is confirmed clean:
--    select id, username from public.players where points_in_escrow > points_balance;
--    alter table public.players validate constraint players_escrow_within_balance;
-- ------------------------------------------------------------
alter table public.players
  add constraint players_escrow_within_balance
  check (points_in_escrow <= points_balance) not valid;

-- ------------------------------------------------------------
-- 4. Room access helpers and the invite-code lookup
-- ------------------------------------------------------------
-- Used by RLS policies. Security definer so policies on room_members can call it without recursing.
create or replace function private.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = private.get_player_id_from_auth()
  );
$$;

-- Used by RLS policies: true for the caller's own player and anyone they share a room with.
create or replace function private.shares_room_with(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_player_id = private.get_player_id_from_auth()
    or exists (
      select 1
      from public.room_members me
      join public.room_members them on them.room_id = me.room_id
      where me.player_id = private.get_player_id_from_auth()
        and them.player_id = p_player_id
    );
$$;

-- Used by RLS policies on options, tags, bets and duels.
create or replace function private.can_view_prediction(p_prediction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.predictions p
    where p.id = p_prediction_id
      and private.is_room_member(p.room_id)
  );
$$;

-- Used by RLS policies on duel_queue.
create or replace function private.can_view_duel(p_duel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.duels d
    where d.id = p_duel_id
      and private.can_view_prediction(d.prediction_id)
  );
$$;

-- Used by RLS policies on series results tables.
create or replace function private.can_view_series(p_series_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.series s
    where s.id = p_series_id
      and private.is_room_member(s.room_id)
  );
$$;

-- Room lookup by invite code. Members get the full room; anyone else holding the
-- code gets enough to show the join screen, since table reads are member-only.
create or replace function public.get_room_by_code(
  p_room_code text
)
returns json
language plpgsql
stable
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
        and rm.is_organizer = true
      order by rm.joined_at
      limit 1
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- 5. Member-only read policies
-- ------------------------------------------------------------
drop policy if exists "rooms_select" on public.rooms;
create policy "rooms_select" on public.rooms for select to authenticated using (private.is_room_member(id));

drop policy if exists "room_members_select" on public.room_members;
create policy "room_members_select" on public.room_members for select to authenticated using (private.is_room_member(room_id));

drop policy if exists "players_select" on public.players;
create policy "players_select" on public.players for select to authenticated using (private.shares_room_with(id));

drop policy if exists "predictions_select" on public.predictions;
create policy "predictions_select" on public.predictions for select to authenticated using (private.is_room_member(room_id));

drop policy if exists "prediction_options_select" on public.prediction_options;
create policy "prediction_options_select" on public.prediction_options for select to authenticated using (private.can_view_prediction(prediction_id));

drop policy if exists "prediction_tags_select" on public.prediction_tags;
create policy "prediction_tags_select" on public.prediction_tags for select to authenticated using (private.can_view_prediction(prediction_id));

drop policy if exists "bets_select" on public.bets;
create policy "bets_select" on public.bets for select to authenticated using (private.can_view_prediction(prediction_id));

drop policy if exists "duels_select" on public.duels;
create policy "duels_select" on public.duels for select to authenticated using (private.can_view_prediction(prediction_id));

drop policy if exists "duel_queue_select" on public.duel_queue;
create policy "duel_queue_select" on public.duel_queue for select to authenticated using (private.can_view_duel(duel_id));

drop policy if exists "series_select" on public.series;
create policy "series_select" on public.series for select to authenticated using (private.is_room_member(room_id));

drop policy if exists "series_placements_select" on public.series_placements;
create policy "series_placements_select" on public.series_placements for select to authenticated using (private.can_view_series(series_id));

drop policy if exists "series_awards_select" on public.series_awards;
create policy "series_awards_select" on public.series_awards for select to authenticated using (private.can_view_series(series_id));

drop policy if exists "weekly_claims_select" on public.weekly_claims;
create policy "weekly_claims_select" on public.weekly_claims for select to authenticated using (player_id = private.get_player_id_from_auth());

-- Views ran as their owner, which skipped RLS and exposed every room's code.
alter view public.player_rooms_by_activity set (security_invoker = true);
alter view public.series_with_stats set (security_invoker = true);

-- ------------------------------------------------------------
-- 6. Row locks in the points-moving RPCs
-- ------------------------------------------------------------
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
  -- Lock the player row so concurrent bets can't both spend the same points.
  select * into v_player
  from public.players
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  select * into v_prediction
  from public.predictions
  where id = p_prediction_id and status = 'draft'
  for share;

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
  -- Lock the player row so concurrent bets can't both spend the same points.
  select * into v_player
  from public.players
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  select * into v_prediction
  from public.predictions
  where id = p_prediction_id and status = 'draft'
  for share;

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
    and status = 'draft'
  for update;

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
    and status  = 'locked'
  -- Lock the prediction so a second resolve call waits, then finds it no longer locked.
  for update;

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
        points_balance   = points_balance   + v_winner.total_gain,
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

-- ------------------------------------------------------------
-- 7. Function access allowlist
-- ------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- Called from RLS policies, so they run as the querying user.
grant execute on function private.get_player_id_from_auth() to authenticated;
grant execute on function private.is_room_member(uuid) to authenticated;
grant execute on function private.shares_room_with(uuid) to authenticated;
grant execute on function private.can_view_prediction(uuid) to authenticated;
grant execute on function private.can_view_duel(uuid) to authenticated;
grant execute on function private.can_view_series(uuid) to authenticated;

-- RPCs the web app calls.
grant execute on function public.activate_series(uuid) to authenticated;
grant execute on function public.archive_series(uuid) to authenticated;
grant execute on function public.cancel_bet(uuid) to authenticated;
grant execute on function public.cancel_duel_queue_view(uuid, uuid) to authenticated;
grant execute on function public.cancel_duel_view(uuid, uuid) to authenticated;
grant execute on function public.claim_weekly_points(boolean) to authenticated;
grant execute on function public.collect_series_rewards(uuid) to authenticated;
grant execute on function public.complete_series(uuid) to authenticated;
grant execute on function public.create_duel_view(uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.create_prediction(uuid, text, text[], timestamp with time zone, uuid) to authenticated;
grant execute on function public.create_room(text) to authenticated;
grant execute on function public.create_series(uuid, text, text, integer) to authenticated;
grant execute on function public.get_player() to authenticated;
grant execute on function public.get_prediction_duel_summary(uuid) to authenticated;
grant execute on function public.get_prediction_duels_view(uuid) to authenticated;
grant execute on function public.get_preferences(uuid) to authenticated;
grant execute on function public.get_room_activities(uuid, integer, timestamp with time zone, uuid, text, uuid) to authenticated;
grant execute on function public.get_room_by_code(text) to authenticated;
grant execute on function public.get_room_has_unseen_activities(uuid) to authenticated;
grant execute on function public.get_room_leaderboard(uuid, text) to authenticated;
grant execute on function public.get_room_member_recent_predictions(uuid, uuid, integer, integer) to authenticated;
grant execute on function public.get_room_member_stats(uuid, uuid) to authenticated;
grant execute on function public.get_room_prediction_history(uuid, integer, timestamp with time zone, uuid, text, text, uuid) to authenticated;
grant execute on function public.get_room_series(uuid) to authenticated;
grant execute on function public.get_room_series_selector(uuid, uuid, text) to authenticated;
grant execute on function public.get_room_stat_cards(uuid, integer) to authenticated;
grant execute on function public.get_room_weekly_leaderboard(uuid, text) to authenticated;
grant execute on function public.get_series_awards(uuid, uuid) to authenticated;
grant execute on function public.get_series_leaderboard(uuid, uuid, text) to authenticated;
grant execute on function public.get_series_placements(uuid, uuid) to authenticated;
grant execute on function public.join_duel_queue_view(uuid, uuid, uuid) to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.mark_how_to_play_seen() to authenticated;
grant execute on function public.mark_ratings_tip_seen() to authenticated;
grant execute on function public.mark_room_activities_seen(uuid) to authenticated;
grant execute on function public.place_bet(uuid, uuid, integer) to authenticated;
grant execute on function public.register_player(text) to authenticated;
grant execute on function public.reset_room_preferences(uuid) to authenticated;
grant execute on function public.resolve_prediction_v2(uuid, uuid, text, uuid, character varying) to authenticated;
grant execute on function public.set_last_visited_room(uuid) to authenticated;
grant execute on function public.update_global_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.update_room_preferences(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.update_series(uuid, text, text, integer) to authenticated;
grant execute on function public.upsert_user_push_subscription(jsonb) to authenticated;
