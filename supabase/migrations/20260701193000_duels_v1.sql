-- ============================================================
-- Migration: duels_v1
-- Description: V1 duel system with transactional queue matching
-- ============================================================

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.predictions(id) on delete cascade,
  challenger_player_id uuid not null references public.players(id) on delete cascade,
  challenger_bet_id uuid not null references public.bets(id) on delete restrict,
  stake_amount integer not null check (stake_amount >= 100 and stake_amount % 100 = 0),
  fee_amount integer not null check (fee_amount >= 0),
  status text not null check (status in ('created', 'queued', 'matched', 'resolved', 'cancelled', 'expired')),
  matched_opponent_player_id uuid references public.players(id) on delete restrict,
  matched_opponent_bet_id uuid references public.bets(id) on delete restrict,
  created_at timestamptz not null default now(),
  matched_at timestamptz,
  resolved_at timestamptz,
  constraint duels_match_fields_pair check (
    (matched_opponent_player_id is null and matched_opponent_bet_id is null)
    or
    (matched_opponent_player_id is not null and matched_opponent_bet_id is not null)
  ),
  constraint duels_opponents_differ check (
    matched_opponent_player_id is null or matched_opponent_player_id <> challenger_player_id
  )
);

create index if not exists idx_duels_prediction_status on public.duels (prediction_id, status);
create index if not exists idx_duels_prediction_created on public.duels (prediction_id, created_at);
create unique index if not exists uq_duels_active_challenger
  on public.duels (prediction_id, challenger_player_id)
  where status in ('created', 'queued', 'matched');

create table if not exists public.duel_queue (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duels(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  bet_id uuid not null references public.bets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (duel_id, player_id)
);

create index if not exists idx_duel_queue_duel_created on public.duel_queue (duel_id, created_at);
create index if not exists idx_duel_queue_player on public.duel_queue (player_id);

create table if not exists private.duel_events (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duels(id) on delete cascade,
  prediction_id uuid not null references public.predictions(id) on delete cascade,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_duel_events_prediction_created on private.duel_events (prediction_id, created_at desc);
create index if not exists idx_duel_events_duel_created on private.duel_events (duel_id, created_at desc);

alter table public.duels enable row level security;
revoke all on public.duels from anon;
drop policy if exists "duels_select" on public.duels;
create policy "duels_select" on public.duels for select using (true);
drop policy if exists "duels_no_direct_insert" on public.duels;
create policy "duels_no_direct_insert" on public.duels for insert with check (false);
drop policy if exists "duels_no_direct_update" on public.duels;
create policy "duels_no_direct_update" on public.duels for update using (false);
drop policy if exists "duels_no_direct_delete" on public.duels;
create policy "duels_no_direct_delete" on public.duels for delete using (false);
grant select (id, prediction_id, challenger_player_id, challenger_bet_id, stake_amount, fee_amount, status, matched_opponent_player_id, matched_opponent_bet_id, created_at, matched_at, resolved_at) on public.duels to anon;
grant select (id, prediction_id, challenger_player_id, challenger_bet_id, stake_amount, fee_amount, status, matched_opponent_player_id, matched_opponent_bet_id, created_at, matched_at, resolved_at) on public.duels to authenticated;

alter table public.duel_queue enable row level security;
revoke all on public.duel_queue from anon;
drop policy if exists "duel_queue_select" on public.duel_queue;
create policy "duel_queue_select" on public.duel_queue for select using (true);
drop policy if exists "duel_queue_no_direct_insert" on public.duel_queue;
create policy "duel_queue_no_direct_insert" on public.duel_queue for insert with check (false);
drop policy if exists "duel_queue_no_direct_update" on public.duel_queue;
create policy "duel_queue_no_direct_update" on public.duel_queue for update using (false);
drop policy if exists "duel_queue_no_direct_delete" on public.duel_queue;
create policy "duel_queue_no_direct_delete" on public.duel_queue for delete using (false);
grant select (id, duel_id, player_id, bet_id, created_at) on public.duel_queue to anon;
grant select (id, duel_id, player_id, bet_id, created_at) on public.duel_queue to authenticated;

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
begin
  insert into private.duel_events (duel_id, prediction_id, event_type, event_payload)
  values (p_duel_id, p_prediction_id, p_event_type, coalesce(p_event_payload, '{}'::jsonb));
end;
$$;

create or replace function private.validate_duel_record()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_challenger_bet public.bets%rowtype;
  v_opponent_bet public.bets%rowtype;
begin
  select * into v_challenger_bet
  from public.bets
  where id = NEW.challenger_bet_id;

  if not found then
    raise exception 'Challenger bet does not exist' using errcode = 'P0001';
  end if;

  if v_challenger_bet.prediction_id <> NEW.prediction_id then
    raise exception 'Challenger bet must belong to duel prediction' using errcode = 'P0001';
  end if;

  if v_challenger_bet.player_id <> NEW.challenger_player_id then
    raise exception 'Challenger bet must belong to challenger player' using errcode = 'P0001';
  end if;

  if v_challenger_bet.amount < 100 then
    raise exception 'Challenger bet must be at least 100 points to enable duels' using errcode = 'P0001';
  end if;

  -- if NEW.stake_amount > v_challenger_bet.amount then
  --   raise exception 'Duel stake cannot exceed challenger bet amount' using errcode = 'P0001';
  -- end if;

  if NEW.matched_opponent_bet_id is not null then
    select * into v_opponent_bet
    from public.bets
    where id = NEW.matched_opponent_bet_id;

    if not found then
      raise exception 'Matched opponent bet does not exist' using errcode = 'P0001';
    end if;

    if v_opponent_bet.prediction_id <> NEW.prediction_id then
      raise exception 'Matched opponent bet must belong to duel prediction' using errcode = 'P0001';
    end if;

    if v_opponent_bet.player_id <> NEW.matched_opponent_player_id then
      raise exception 'Matched opponent bet must belong to matched opponent player' using errcode = 'P0001';
    end if;

    if v_opponent_bet.amount < 100 then
      raise exception 'Opponent bet must be at least 100 points to duel' using errcode = 'P0001';
    end if;

    -- if NEW.stake_amount > v_opponent_bet.amount then
    --   raise exception 'Duel stake cannot exceed opponent bet amount' using errcode = 'P0001';
    -- end if;

    if v_opponent_bet.option_id = v_challenger_bet.option_id then
      raise exception 'Matched opponent must be on opposite option' using errcode = 'P0001';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_validate_duel_record on public.duels;
create trigger trg_validate_duel_record
before insert or update on public.duels
for each row execute function private.validate_duel_record();

create or replace function private.validate_duel_queue_record()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_duel public.duels%rowtype;
  v_bet public.bets%rowtype;
begin
  select * into v_duel
  from public.duels
  where id = NEW.duel_id;

  if not found then
    raise exception 'Duel not found' using errcode = 'P0006';
  end if;

  select * into v_bet
  from public.bets
  where id = NEW.bet_id;

  if not found then
    raise exception 'Bet not found' using errcode = 'P0006';
  end if;

  if v_bet.prediction_id <> v_duel.prediction_id then
    raise exception 'Queue bet must belong to duel prediction' using errcode = 'P0001';
  end if;

  if v_bet.player_id <> NEW.player_id then
    raise exception 'Queue bet must belong to queue player' using errcode = 'P0001';
  end if;

  if v_bet.amount < 100 then
    raise exception 'Bet must be at least 100 points to join duel queue' using errcode = 'P0001';
  end if;

  -- if v_duel.stake_amount > v_bet.amount then
  --   raise exception 'Duel stake cannot exceed queued bet amount' using errcode = 'P0001';
  -- end if;

  return NEW;
end;
$$;

drop trigger if exists trg_validate_duel_queue_record on public.duel_queue;
create trigger trg_validate_duel_queue_record
before insert or update on public.duel_queue
for each row execute function private.validate_duel_queue_record();

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

drop trigger if exists trg_prevent_locked_duel_bet_changes on public.bets;
create trigger trg_prevent_locked_duel_bet_changes
before update or delete on public.bets
for each row execute function private.prevent_locked_duel_bet_changes();

create or replace function public.create_duel(
  p_prediction_id uuid,
  p_challenger_player_id uuid,
  p_bet_id uuid,
  p_stake_amount integer
)
returns public.duels
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_auth_player_id uuid;
  v_prediction public.predictions%rowtype;
  v_player public.players%rowtype;
  v_bet public.bets%rowtype;
  v_duel public.duels%rowtype;
  v_fee integer;
  v_available integer;
begin
  v_auth_player_id := private.get_player_id_from_auth();

  if v_auth_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if v_auth_player_id <> p_challenger_player_id then
    raise exception 'You can only create duels for yourself' using errcode = 'P0013';
  end if;

  if p_stake_amount < 100 or p_stake_amount % 100 <> 0 then
    raise exception 'Duel stake must be a multiple of 100 and at least 100' using errcode = 'P0001';
  end if;

  select * into v_prediction
  from public.predictions
  where id = p_prediction_id
    and status = 'draft'
  for update;

  if not found then
    raise exception 'Prediction not found or not in draft phase' using errcode = 'P0006';
  end if;

  select * into v_bet
  from public.bets
  where id = p_bet_id
    and prediction_id = p_prediction_id
    and player_id = p_challenger_player_id
  for update;

  if not found then
    raise exception 'Bet not found for this prediction/player' using errcode = 'P0006';
  end if;

  if v_bet.amount < 100 then
    raise exception 'Minimum bet is 100 points to create duels' using errcode = 'P0001';
  end if;

  -- if p_stake_amount > v_bet.amount then
  --   raise exception 'Duel stake cannot exceed bet amount' using errcode = 'P0001';
  -- end if;

  if exists (
    select 1
    from public.duels d
    where d.prediction_id = p_prediction_id
      and d.challenger_player_id = p_challenger_player_id
      and d.status in ('created', 'queued', 'matched')
  ) then
    raise exception 'You already have an active duel for this prediction' using errcode = 'P0001';
  end if;

  select * into v_player
  from public.players
  where id = p_challenger_player_id
  for update;

  if not found then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  v_fee := greatest(ceil((p_stake_amount::numeric * 0.02))::integer, 5);
  v_available := v_player.points_balance - v_player.points_in_escrow;

  if v_available < (v_fee + p_stake_amount) then
    raise exception 'Insufficient available points for duel fee and stake' using errcode = 'P0009';
  end if;

  update public.players
  set points_balance = points_balance - v_fee,
      points_in_escrow = points_in_escrow + p_stake_amount
  where id = p_challenger_player_id;

  insert into public.duels (
    prediction_id,
    challenger_player_id,
    challenger_bet_id,
    stake_amount,
    fee_amount,
    status
  )
  values (
    p_prediction_id,
    p_challenger_player_id,
    p_bet_id,
    p_stake_amount,
    v_fee,
    'created'
  )
  returning * into v_duel;

  perform private.log_duel_event(
    v_duel.id,
    p_prediction_id,
    'duel_created',
    jsonb_build_object(
      'challenger_player_id', p_challenger_player_id,
      'stake_amount', p_stake_amount,
      'fee_amount', v_fee
    )
  );

  return v_duel;
end;
$$;

create or replace function public.match_duel_queue(
  p_duel_id uuid
)
returns public.duels
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_duel public.duels%rowtype;
  v_challenger_bet public.bets%rowtype;
  v_candidate record;
  v_refund_candidate record;
  v_matched_queue_id uuid;
  v_matched_player_id uuid;
  v_matched_bet_id uuid;
begin
  select * into v_duel
  from public.duels
  where id = p_duel_id
  for update;

  if not found then
    raise exception 'Duel not found' using errcode = 'P0006';
  end if;

  if v_duel.status in ('matched', 'resolved', 'cancelled', 'expired') then
    return v_duel;
  end if;

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
      b.amount,
      p.points_balance,
      p.points_in_escrow
    from public.duel_queue dq
    join public.bets b on b.id = dq.bet_id
    join public.players p on p.id = dq.player_id
    where dq.duel_id = p_duel_id
    order by dq.created_at asc, dq.id asc
    for update of dq, b, p skip locked
  loop
    if v_candidate.amount < v_duel.stake_amount then
      continue;
    end if;

    if v_candidate.option_id = v_challenger_bet.option_id then
      continue;
    end if;

    if (v_candidate.points_balance - v_candidate.points_in_escrow) < 0 then
      continue;
    end if;

    v_matched_queue_id := v_candidate.queue_id;
    v_matched_player_id := v_candidate.player_id;
    v_matched_bet_id := v_candidate.bet_id;
    exit;
  end loop;

  if v_matched_player_id is null then
    if v_duel.status = 'created' and exists (
      select 1 from public.duel_queue where duel_id = p_duel_id
    ) then
      update public.duels
      set status = 'queued'
      where id = p_duel_id
      returning * into v_duel;
    end if;

    return v_duel;
  end if;

  update public.duels
  set matched_opponent_player_id = v_matched_player_id,
      matched_opponent_bet_id = v_matched_bet_id,
      status = 'matched',
      matched_at = now()
  where id = p_duel_id
  returning * into v_duel;

  for v_refund_candidate in
    select dq.player_id
    from public.duel_queue dq
    where dq.duel_id = p_duel_id
      and dq.id <> v_matched_queue_id
    for update of dq skip locked
  loop
    update public.players
    set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
    where id = v_refund_candidate.player_id;
  end loop;

  delete from public.duel_queue
  where duel_id = p_duel_id;

  perform private.log_duel_event(
    v_duel.id,
    v_duel.prediction_id,
    'duel_matched',
    jsonb_build_object(
      'challenger_player_id', v_duel.challenger_player_id,
      'opponent_player_id', v_duel.matched_opponent_player_id,
      'stake_amount', v_duel.stake_amount
    )
  );

  return v_duel;
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

  if v_duel.matched_opponent_player_id is not null then
    raise exception 'Duel already has a matched opponent' using errcode = 'P0001';
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

  -- if v_duel.stake_amount > v_bet.amount then
  --   raise exception 'Duel stake cannot exceed your bet amount' using errcode = 'P0001';
  -- end if;

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

  perform public.match_duel_queue(p_duel_id);

  select * into v_duel
  from public.duels
  where id = p_duel_id;

  return v_duel;
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
    select dq.player_id
    from public.duel_queue dq
    where dq.duel_id = p_duel_id
    for update of dq skip locked
  loop
    update public.players
    set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
    where id = v_refund_candidate.player_id;
  end loop;

  delete from public.duel_queue where duel_id = p_duel_id;

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
      select dq.player_id
      from public.duel_queue dq
      where dq.duel_id = v_duel.id
      for update of dq skip locked
    loop
      update public.players
      set points_in_escrow = greatest(points_in_escrow - v_duel.stake_amount, 0)
      where id = v_queue.player_id;
    end loop;

    delete from public.duel_queue where duel_id = v_duel.id;

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

create or replace function private.on_prediction_duel_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_duel record;
begin
  if TG_OP = 'UPDATE'
     and OLD.status = 'draft'
     and NEW.status = 'locked' then
    for v_duel in
      select id
      from public.duels
      where prediction_id = NEW.id
        and status in ('created', 'queued')
      order by created_at asc
    loop
      perform public.match_duel_queue(v_duel.id);
    end loop;
  elsif TG_OP = 'UPDATE'
     and OLD.status = 'locked'
     and NEW.status in ('revealed', 'no_result', 'cancelled') then
    perform public.resolve_duels_for_prediction(NEW.id);
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_predictions_duel_status on public.predictions;
create trigger trg_predictions_duel_status
after update of status on public.predictions
for each row execute function private.on_prediction_duel_status_change();

grant execute on function public.create_duel(uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.join_duel_queue(uuid, uuid, uuid) to authenticated;
grant execute on function public.cancel_duel(uuid, uuid) to authenticated;

revoke all on function public.match_duel_queue(uuid) from public;
revoke all on function public.match_duel_queue(uuid) from authenticated;
revoke all on function public.resolve_duels_for_prediction(uuid) from public;
revoke all on function public.resolve_duels_for_prediction(uuid) from authenticated;
revoke all on function private.log_duel_event(uuid, uuid, text, jsonb) from public;
revoke all on function private.log_duel_event(uuid, uuid, text, jsonb) from authenticated;
revoke all on function private.on_prediction_duel_status_change() from public;
revoke all on function private.on_prediction_duel_status_change() from authenticated;
