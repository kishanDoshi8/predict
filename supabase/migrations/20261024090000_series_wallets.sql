-- ============================================================
-- Migration: series_wallets
-- Description: Series become the main event. Points move from one global
--   wallet per player to one wallet per player per series. Every member
--   starts each series with the same stack and gets the same weekly top-up.
--   Weekly claims, the all-time leaderboard and new duels are retired.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Pre-flight: open bets hold escrow in the old wallets, so they must be settled first
-- ------------------------------------------------------------
do $$
declare
  v_open integer;
begin
  select count(*) into v_open
  from public.predictions
  where status in ('draft', 'locked');

  if v_open > 0 then
    raise exception 'Resolve or cancel the % open prediction(s) before applying series_wallets', v_open;
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. Series points settings
-- ------------------------------------------------------------
alter table public.series
  add column if not exists starting_stack integer not null default 1000 check (starting_stack between 100 and 1000000),
  add column if not exists weekly_topup integer not null default 100 check (weekly_topup between 0 and 100000),
  add column if not exists topups_paid integer not null default 0 check (topups_paid >= 0),
  add column if not exists last_topup_week text;

-- ------------------------------------------------------------
-- 2. Series wallets
-- ------------------------------------------------------------
-- Points live per series: one wallet per player per series.
create table if not exists public.series_wallets (
  series_id uuid not null references public.series(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  balance integer not null check (balance >= 0),
  escrow integer not null default 0 check (escrow >= 0),
  -- Starting stack plus every top-up received, so net profit is balance - granted.
  granted integer not null check (granted >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (series_id, player_id),
  constraint series_wallets_escrow_within_balance check (escrow <= balance)
);

create index if not exists idx_series_wallets_player on public.series_wallets(player_id);

alter table public.series_wallets enable row level security;
revoke all on public.series_wallets from anon;
revoke insert, update, delete, truncate, references, trigger on public.series_wallets from authenticated;

drop policy if exists "series_wallets_select" on public.series_wallets;
create policy "series_wallets_select" on public.series_wallets for select to authenticated using (private.can_view_series(series_id));

grant select (series_id, player_id, balance, escrow, granted, created_at, updated_at) on public.series_wallets to authenticated;

-- ------------------------------------------------------------
-- 3. Functions
-- ------------------------------------------------------------
-- Signatures gain points settings; drop the old ones so calls aren't ambiguous.
drop function if exists public.create_series(uuid, text, text, integer);
drop function if exists public.update_series(uuid, text, text, integer);

-- Gives a player their wallet for a series if they don't have one yet.
-- Late joiners get the stack plus every top-up already paid, so they start level.
create or replace function private.ensure_series_wallet(
  p_series_id uuid,
  p_player_id uuid
)
returns void
language sql
security definer
set search_path = public, private
as $$
  insert into public.series_wallets (series_id, player_id, balance, granted)
  select
    s.id,
    p_player_id,
    s.starting_stack + s.weekly_topup * s.topups_paid,
    s.starting_stack + s.weekly_topup * s.topups_paid
  from public.series s
  where s.id = p_series_id
    and s.status = 'active'
  on conflict (series_id, player_id) do nothing;
$$;

-- Run by the series-weekly-topup cron job every Monday.
-- Pays each active series' weekly top-up to every wallet, at most once per ISO week.
create or replace function private.pay_series_topups()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_week_key text := private.current_week_key();
  v_series   record;
  v_count    integer := 0;
begin
  for v_series in
    select s.id, s.room_id, s.title, s.weekly_topup, r.room_code
    from public.series s
    join public.rooms r on r.id = s.room_id
    where s.status = 'active'
      and s.weekly_topup > 0
      and s.last_topup_week is distinct from v_week_key
    for update of s
  loop
    update public.series_wallets
    set balance = balance + v_series.weekly_topup,
        granted = granted + v_series.weekly_topup,
        updated_at = now()
    where series_id = v_series.id;

    update public.series
    set topups_paid = topups_paid + 1,
        last_topup_week = v_week_key
    where id = v_series.id;

    perform private.fire_push_notification(
      'weekly_points_claim',
      null,
      v_series.room_id,
      '+' || v_series.weekly_topup || ' points',
      'Your weekly top-up for ' || v_series.title || ' is in.',
      '/rooms/' || v_series.room_code
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.create_series(
  p_room_id uuid,
  p_title text,
  p_description text default null,
  p_expected_games integer default 0,
  p_starting_stack integer default 1000,
  p_weekly_topup integer default 100
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
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
    and is_organizer = true;

  if not found then
    raise exception 'Only the organizer can manage series' using errcode = 'P0012';
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
    -- The first top-up is paid the Monday after the series starts.
    private.current_week_key()
  )
  returning * into v_series;

  perform private.ensure_series_wallet(v_series.id, rm.player_id)
  from public.room_members rm
  where rm.room_id = p_room_id;

  return row_to_json(v_series);
end;
$$;

create or replace function public.update_series(
  p_series_id uuid,
  p_title text,
  p_description text default null,
  p_expected_games integer default 0,
  p_starting_stack integer default null,
  p_weekly_topup integer default null
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
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
   and rm.is_organizer = true
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
    weekly_topup = coalesce(p_weekly_topup, weekly_topup)
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
$$;

create or replace function public.activate_series(
  p_series_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
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
   and rm.is_organizer = true
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
    'created_at',   v_room.created_at
  );
end;
$$;

create or replace function public.create_prediction(
  p_room_id  uuid,
  p_title    text,
  p_options  text[],
  p_deadline timestamptz,
  p_series_id uuid default null
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
  v_series          public.series%rowtype;
  v_series_prediction_number int;
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
$$;

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
  v_wallet        public.series_wallets%rowtype;
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

  if v_prediction.series_id is null then
    raise exception 'This prediction is not part of a series' using errcode = 'P0001';
  end if;

  perform private.ensure_series_wallet(v_prediction.series_id, v_player.id);

  -- Lock the wallet so concurrent bets can't both spend the same points.
  select * into v_wallet
  from public.series_wallets
  where series_id = v_prediction.series_id
    and player_id = v_player.id
  for update;

  if not found then
    raise exception 'No points wallet for this series' using errcode = 'P0009';
  end if;

  select * into v_existing_bet
  from public.bets
  where prediction_id = p_prediction_id and player_id = v_player.id;

  if found then
    v_old_amount := v_existing_bet.amount;
  end if;

  v_available := v_wallet.balance - v_wallet.escrow + v_old_amount;

  if p_amount > v_available then
    raise exception 'Insufficient points. Available: %, Requested: %', v_available, p_amount
    using errcode = 'P0009';
  end if;

  v_escrow_delta := p_amount - v_old_amount;

  if v_old_amount > 0 then
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

  update public.series_wallets
  set escrow     = escrow + v_escrow_delta,
      updated_at = now()
  where series_id = v_wallet.series_id
    and player_id = v_wallet.player_id
  returning * into v_wallet;

  return json_build_object(
    'bet_placed',       true,
    'prediction_id',    p_prediction_id,
    'option_id',        p_option_id,
    'amount',           p_amount,
    'series_id',        v_wallet.series_id,
    'points_available', v_wallet.balance - v_wallet.escrow
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
  select * into v_player
  from public.players
  where user_id = auth.uid();

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

  -- Lock the wallet so a concurrent bet sees the freed points correctly.
  perform 1
  from public.series_wallets
  where series_id = v_prediction.series_id
    and player_id = v_player.id
  for update;

  select * into v_bet
  from public.bets
  where prediction_id = p_prediction_id and player_id = v_player.id;

  if not found then
    raise exception 'No bet found to cancel' using errcode = 'P0010';
  end if;

  update public.prediction_options
  set total_bet = total_bet - v_bet.amount
  where id = v_bet.option_id;

  update public.series_wallets
  set escrow     = escrow - v_bet.amount,
      updated_at = now()
  where series_id = v_prediction.series_id
    and player_id = v_player.id;

  delete from public.bets where id = v_bet.id;

  return json_build_object(
    'cancelled',    true,
    'points_freed', v_bet.amount
  );
end;
$$;

create or replace function private.refund_all_bets_v2(p_prediction_id uuid)
returns void
language plpgsql
as $$
declare
  v_bet       public.bets%rowtype;
  v_series_id uuid;
begin
  select series_id into v_series_id
  from public.predictions
  where id = p_prediction_id;

  for v_bet in
    select * from public.bets
    where prediction_id = p_prediction_id
  loop
    update public.series_wallets
    set escrow     = escrow - v_bet.amount,
        updated_at = now()
    where series_id = v_series_id
      and player_id = v_bet.player_id;

    update public.bets
    set payout = v_bet.amount   -- full refund = original stake
    where id = v_bet.id;
  end loop;
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

create or replace function public.get_series_leaderboard(
  p_room_id uuid,
  p_series_id uuid,
  p_sort_by text default 'points'
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_caller_id uuid;
  v_is_member boolean;
  v_series public.series%rowtype;
  v_result json;
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

  select * into v_series
  from public.series s
  where s.id = p_series_id
    and s.room_id = p_room_id;

  if not found then
    raise exception 'Series not found for this room' using errcode = 'P0002';
  end if;

  if p_sort_by not in ('points', 'rating', 'accuracy', 'streak') then
    raise exception 'Invalid sort mode: %', p_sort_by using errcode = 'P0001';
  end if;

  with stats as (
    select *
    from private.get_leaderboard_player_stats(
      p_room_id,
      p_series_id,
      false
    )
  ),
  base_current as (
    select
      rm.player_id,
      p.username,
      coalesce(s.net_profit, 0) as total_won_in_room,
      -- Series that closed before wallets existed fall back to stack + profit.
      coalesce(w.balance, v_series.starting_stack + coalesce(s.net_profit, 0)::int) as balance,
      coalesce(w.balance - w.escrow, v_series.starting_stack + coalesce(s.net_profit, 0)::int) as available,
      coalesce(w.granted, v_series.starting_stack) as granted,
      rm.joined_at,
      rm.is_organizer,
      rm.current_streak,
      rm.highest_streak,
      rm.prediction_rating,
      rm.peak_prediction_rating,
      rm.rated_predictions_count,
      coalesce(s.total_bets, 0) as total_bets,
      coalesce(s.total_revealed_bets, 0) as total_revealed_bets,
      coalesce(s.winning_bets, 0) as winning_bets,
      coalesce(s.total_wagered, 0) as total_wagered,
      coalesce(s.total_payout, 0) as total_payout,
      coalesce(s.total_profit, 0) as total_profit,
      coalesce(s.total_loss, 0) as total_loss,
      coalesce(s.net_profit, 0) as net_points,
      case
        when coalesce(s.total_revealed_bets, 0) > 0 then
          round((coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets) * 100, 1)
        else 0
      end as win_percentage,
      case
        when coalesce(s.total_revealed_bets, 0) > 0 then
          coalesce(s.winning_bets, 0)::numeric / s.total_revealed_bets
      end as accuracy_ratio
    from public.room_members rm
    join public.players p on p.id = rm.player_id
    left join stats s on s.player_id = rm.player_id
    left join public.series_wallets w on w.series_id = p_series_id and w.player_id = rm.player_id
    where rm.room_id = p_room_id
  ),
  ranked as (
    select
      bc.*,
      rank() over (
        order by
          case when p_sort_by = 'points' then bc.balance end desc nulls last,
          case when p_sort_by = 'points' then bc.winning_bets end desc nulls last,
          case when p_sort_by = 'rating' then bc.prediction_rating end desc nulls last,
          case when p_sort_by = 'rating' then bc.rated_predictions_count end desc nulls last,
          case when p_sort_by = 'accuracy' then bc.accuracy_ratio end desc nulls last,
          case when p_sort_by = 'accuracy' then bc.total_revealed_bets end desc nulls last,
          case when p_sort_by = 'streak' then bc.current_streak end desc nulls last,
          case when p_sort_by = 'streak' then bc.highest_streak end desc nulls last,
          bc.joined_at asc nulls last
      ) as rank
    from base_current bc
  )
  select json_agg(lb order by lb.rank, lb.player_id)
  into v_result
  from (
    select
      r.player_id,
      r.username,
      r.total_won_in_room,
      r.balance,
      r.available,
      r.granted,
      r.joined_at,
      r.is_organizer,
      r.current_streak,
      r.highest_streak,
      r.prediction_rating,
      r.peak_prediction_rating,
      r.rated_predictions_count,
      r.total_bets,
      r.total_revealed_bets,
      r.winning_bets,
      r.total_wagered,
      r.total_payout,
      r.net_points,
      r.net_points as net_profit,
      r.win_percentage,
      r.rank,
      null::int as previous_rank,
      null::int as rank_change,
      null::numeric as previous_prediction_rating,
      null::numeric as rating_change,
      null::numeric as previous_total_won_in_room,
      null::numeric as points_change
    from ranked r
  ) lb;

  return coalesce(v_result, '[]'::json);
end;
$$;

create or replace function public.complete_series(
  p_series_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_series public.series%rowtype;
  v_unfinished_predictions integer;
  v_minimum_predictions integer;
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
   and rm.is_organizer = true
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

  v_minimum_predictions := coalesce(v_series.minimum_predictions_for_awards, 3);

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
    join series_predictions sp on sp.id = b.prediction_id
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_minimum_predictions
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
    select p.id
    from public.predictions p
    where p.series_id = p_series_id
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as prediction_count
    from public.bets b
    join series_predictions sp on sp.id = b.prediction_id
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_minimum_predictions
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
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_minimum_predictions
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
    select p.id
    from public.predictions p
    where p.series_id = p_series_id
  ),
  player_participation as (
    select
      b.player_id,
      count(distinct b.prediction_id)::int as prediction_count
    from public.bets b
    join series_predictions sp on sp.id = b.prediction_id
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_minimum_predictions
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
    group by b.player_id
  ),
  eligible_players as (
    select pp.player_id
    from player_participation pp
    where pp.prediction_count >= v_minimum_predictions
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
$$;

-- The caller's points in each series of a room, active series first.
create or replace function public.get_my_series_wallets(
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
  v_result    json;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not private.is_room_member(p_room_id) then
    raise exception 'You are not a member of this room' using errcode = 'P0011';
  end if;

  select coalesce(json_agg(row_to_json(w) order by w.status_order, w.started_at desc nulls last), '[]'::json)
  into v_result
  from (
    select
      s.id as series_id,
      s.title,
      s.status,
      s.starting_stack,
      s.weekly_topup,
      sw.balance,
      sw.escrow,
      sw.balance - sw.escrow as available,
      sw.granted,
      sw.balance - sw.granted as net_profit,
      s.started_at,
      case s.status when 'active' then 0 else 1 end as status_order
    from public.series_wallets sw
    join public.series s on s.id = sw.series_id
    where sw.player_id = v_player_id
      and s.room_id = p_room_id
  ) w;

  return v_result;
end;
$$;

-- Stops the old "Claim your 100 free points" push.
create or replace function private.run_weekly_processing()
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_snapshot_result json;
begin
  -- Snapshot room-member state for weekly movement calculations.
  -- Weekly claims are retired; series top-ups (private.pay_series_topups) send their own notice.
  v_snapshot_result := public.create_weekly_room_member_snapshots();

  return json_build_object(
    'snapshots_created',
    coalesce((v_snapshot_result->>'snapshots_created')::integer, 0)
  );
end;
$$;

-- ------------------------------------------------------------
-- 4. Series view gains the points settings
-- ------------------------------------------------------------
create or replace view public.series_with_stats
with (security_invoker = true) as
with series_prediction_stats as (
  select
    p.series_id,
    count(*)::int as total_predictions,
    count(*) filter (where p.status in ('draft', 'locked'))::int as active_predictions,
    count(*) filter (where p.status in ('revealed', 'no_result'))::int as completed_predictions,
    count(*) filter (where p.status = 'cancelled')::int as cancelled_predictions
  from public.predictions p
  where p.series_id is not null
  group by p.series_id
)
select
  s.id,
  s.room_id,
  s.title,
  s.description,
  s.status,
  s.expected_games,
  coalesce(sps.total_predictions, 0) as prediction_count,
  coalesce(sps.completed_predictions, 0) as completed_games,
  coalesce(sps.total_predictions, 0) as total_predictions,
  coalesce(sps.active_predictions, 0) as active_predictions,
  coalesce(sps.completed_predictions, 0) as completed_predictions,
  coalesce(sps.cancelled_predictions, 0) as cancelled_predictions,
  greatest(s.expected_games - coalesce(sps.completed_predictions, 0), 0) as remaining_games,
  case
    when s.expected_games > 0 then least(round((coalesce(sps.completed_predictions, 0)::numeric / s.expected_games::numeric) * 100, 2), 100)
    else 0::numeric
  end as progress_percentage,
  s.created_by,
  s.created_at,
  s.started_at,
  s.completed_at,
  s.archived_at,
  s.starting_stack,
  s.weekly_topup,
  s.topups_paid,
  exists (
    select 1
    from public.bets b
    join public.predictions p on p.id = b.prediction_id
    where p.series_id = s.id
  ) as has_bets
from public.series s
left join series_prediction_stats sps on sps.series_id = s.id;

-- ------------------------------------------------------------
-- 5. Data: wallets for active series keep today's standings
-- ------------------------------------------------------------
update public.series
set started_at = coalesce(started_at, created_at),
    last_topup_week = private.current_week_key()
where status = 'active';

insert into public.series_wallets (series_id, player_id, balance, granted)
select
  s.id,
  rm.player_id,
  greatest(s.starting_stack + coalesce(st.net_profit, 0), 0)::int,
  s.starting_stack
from public.series s
join public.room_members rm on rm.room_id = s.room_id
left join lateral private.get_leaderboard_player_stats(s.room_id, s.id, false) st
  on st.player_id = rm.player_id
where s.status = 'active'
on conflict (series_id, player_id) do nothing;

-- The global wallet is retired. Columns stay until a later cleanup.
update public.players
set points_balance = 0,
    points_in_escrow = 0
where points_balance <> 0 or points_in_escrow <> 0;

-- ------------------------------------------------------------
-- 6. Weekly top-up, Mondays 00:05 UTC
-- ------------------------------------------------------------
select cron.schedule('series-weekly-topup', '5 0 * * 1', $$select private.pay_series_topups()$$);

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
-- Paused while duels are hidden: create_duel_view, join_duel_queue_view.
-- Retired with series wallets: claim_weekly_points, get_room_leaderboard.
grant execute on function public.activate_series(uuid) to authenticated;
grant execute on function public.archive_series(uuid) to authenticated;
grant execute on function public.cancel_bet(uuid) to authenticated;
grant execute on function public.cancel_duel_queue_view(uuid, uuid) to authenticated;
grant execute on function public.cancel_duel_view(uuid, uuid) to authenticated;
grant execute on function public.collect_series_rewards(uuid) to authenticated;
grant execute on function public.complete_series(uuid) to authenticated;
grant execute on function public.create_prediction(uuid, text, text[], timestamp with time zone, uuid) to authenticated;
grant execute on function public.create_room(text) to authenticated;
grant execute on function public.create_series(uuid, text, text, integer, integer, integer) to authenticated;
grant execute on function public.get_my_series_wallets(uuid) to authenticated;
grant execute on function public.get_player() to authenticated;
grant execute on function public.get_prediction_duel_summary(uuid) to authenticated;
grant execute on function public.get_prediction_duels_view(uuid) to authenticated;
grant execute on function public.get_preferences(uuid) to authenticated;
grant execute on function public.get_room_activities(uuid, integer, timestamp with time zone, uuid, text, uuid) to authenticated;
grant execute on function public.get_room_by_code(text) to authenticated;
grant execute on function public.get_room_has_unseen_activities(uuid) to authenticated;
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
grant execute on function public.update_series(uuid, text, text, integer, integer, integer) to authenticated;
grant execute on function public.upsert_user_push_subscription(jsonb) to authenticated;
