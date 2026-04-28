-- ============================================================
-- Migration: 005_secure_access
-- Description:
--   - Enable RLS on all tables
--   - Revoke default anon access
--   - Apply column-level SELECT grants
--   - Block direct writes
--   - Drop legacy "safe views"
-- ============================================================

-- ============================================================
-- 1. ENABLE RLS
-- ============================================================

alter table public.players            enable row level security;
alter table public.rooms              enable row level security;
alter table public.room_members       enable row level security;
alter table public.weekly_claims      enable row level security;
alter table public.predictions        enable row level security;
alter table public.prediction_options enable row level security;
alter table public.bets               enable row level security;

-- ============================================================
-- 2. REVOKE DEFAULT ACCESS FROM anon
-- ============================================================

revoke all on public.players            from anon;
revoke all on public.rooms              from anon;
revoke all on public.room_members       from anon;
revoke all on public.weekly_claims      from anon;
revoke all on public.predictions        from anon;
revoke all on public.prediction_options from anon;
revoke all on public.bets               from anon;

-- ============================================================
-- 3. RLS POLICIES (ROW ACCESS ONLY)
--    Public read access. Writes blocked.
-- ============================================================

-- PLAYERS
drop policy if exists "players_select" on public.players;
create policy "players_select"
  on public.players
  for select
  using (true);

drop policy if exists "players_no_direct_write" on public.players;
create policy "players_no_direct_write"
  on public.players
  for insert
  with check (false);

drop policy if exists "players_no_direct_update" on public.players;
create policy "players_no_direct_update"
  on public.players
  for update
  using (false);

drop policy if exists "players_no_direct_delete" on public.players;
create policy "players_no_direct_delete"
  on public.players
  for delete
  using (false);

-- ROOMS
drop policy if exists "rooms_select" on public.rooms;
create policy "rooms_select"
  on public.rooms
  for select
  using (true);

drop policy if exists "rooms_no_direct_write" on public.rooms;
create policy "rooms_no_direct_write"
  on public.rooms
  for insert
  with check (false);

drop policy if exists "rooms_no_direct_update" on public.rooms;
create policy "rooms_no_direct_update"
  on public.rooms
  for update
  using (false);

drop policy if exists "rooms_no_direct_delete" on public.rooms;
create policy "rooms_no_direct_delete"
  on public.rooms
  for delete
  using (false);

-- ROOM_MEMBERS
drop policy if exists "room_members_select" on public.room_members;
create policy "room_members_select"
  on public.room_members
  for select
  using (true);

drop policy if exists "room_members_no_direct_write" on public.room_members;
create policy "room_members_no_direct_write"
  on public.room_members
  for insert
  with check (false);

drop policy if exists "room_members_no_direct_update" on public.room_members;
create policy "room_members_no_direct_update"
  on public.room_members
  for update
  using (false);


drop policy if exists "room_members_no_direct_delete" on public.room_members;
create policy "room_members_no_direct_delete"
  on public.room_members
  for delete
  using (false);

-- WEEKLY_CLAIMS
drop policy if exists "weekly_claims_select" on public.weekly_claims;
create policy "weekly_claims_select"
  on public.weekly_claims
  for select
  using (true);

drop policy if exists "weekly_claims_no_direct_write" on public.weekly_claims;
create policy "weekly_claims_no_direct_write"
  on public.weekly_claims
  for insert
  with check (false);

drop policy if exists "weekly_claims_no_direct_update" on public.weekly_claims;
create policy "weekly_claims_no_direct_update"
  on public.weekly_claims
  for update
  using (false);

drop policy if exists "weekly_claims_no_direct_delete" on public.weekly_claims;
create policy "weekly_claims_no_direct_delete"
  on public.weekly_claims
  for delete
  using (false);

-- PREDICTIONS
drop policy if exists "predictions_select" on public.predictions;
create policy "predictions_select"
  on public.predictions
  for select
  using (true);

drop policy if exists "predictions_no_direct_write" on public.predictions;
create policy "predictions_no_direct_write"
  on public.predictions
  for insert
  with check (false);

drop policy if exists "predictions_no_direct_update" on public.predictions;
create policy "predictions_no_direct_update"
  on public.predictions
  for update
  using (false);

drop policy if exists "predictions_no_direct_delete" on public.predictions;
create policy "predictions_no_direct_delete"
  on public.predictions
  for delete
  using (false);

-- PREDICTION_OPTIONS
drop policy if exists "prediction_options_select" on public.prediction_options;
create policy "prediction_options_select"
  on public.prediction_options
  for select
  using (true);

drop policy if exists "prediction_options_no_direct_write" on public.prediction_options;
create policy "prediction_options_no_direct_write"
  on public.prediction_options
  for insert
  with check (false);

drop policy if exists "prediction_options_no_direct_update" on public.prediction_options;
create policy "prediction_options_no_direct_update"
  on public.prediction_options
  for update
  using (false);

drop policy if exists "prediction_options_no_direct_delete" on public.prediction_options;
create policy "prediction_options_no_direct_delete"
  on public.prediction_options
  for delete
  using (false);

-- BETS
drop policy if exists "bets_select" on public.bets;
create policy "bets_select"
  on public.bets
  for select
  using (true);

drop policy if exists "bets_no_direct_write" on public.bets;
create policy "bets_no_direct_write"
  on public.bets
  for insert
  with check (false);

drop policy if exists "bets_no_direct_update" on public.bets;
create policy "bets_no_direct_update"
  on public.bets
  for update
  using (false);

drop policy if exists "bets_no_direct_delete" on public.bets;
create policy "bets_no_direct_delete"
  on public.bets
  for delete
  using (false);

-- ============================================================
-- 4. COLUMN-LEVEL SELECT GRANTS
--    Sensitive columns intentionally omitted.
-- ============================================================

-- PLAYERS (omit player_token)
grant select (
  id,
  username,
  points_balance,
  points_in_escrow,
  total_won,
  current_streak,
  longest_streak,
  last_claim_at,
  created_at
) on public.players to anon;

-- ROOMS (omit organizer_token)
grant select (
  id,
  room_code,
  name,
  status,
  created_at
) on public.rooms to anon;

-- ROOM_MEMBERS (no sensitive columns assumed)
grant select (
  id,
  room_id,
  player_id,
  is_organizer,
  total_won_in_room,
  joined_at
) on public.room_members to anon;

-- WEEKLY_CLAIMS
grant select (
  id,
  player_id,
  week_key,
  claimed_at
) on public.weekly_claims to anon;

-- PREDICTIONS
grant select (
  id,
  room_id,
  created_by,
  title,
  status,
  deadline,
  winning_option_id,
  resolved_at,
  created_at
) on public.predictions to anon;

-- PREDICTION_OPTIONS
grant select (
  id,
  prediction_id,
  label,
  display_order,
  total_bet,
  created_at
) on public.prediction_options to anon;

-- BETS
grant select (
  id,
  prediction_id,
  player_id,
  option_id,
  amount,
  payout,
  placed_at,
  updated_at
) on public.bets to anon;

-- ============================================================
-- 5. DROP LEGACY SAFE VIEWS (NO LONGER NEEDED)
-- ============================================================

drop view if exists public.players_public cascade;
drop view if exists public.rooms_public cascade;
drop view if exists public.room_members_public cascade;
drop view if exists public.bets_visible cascade;