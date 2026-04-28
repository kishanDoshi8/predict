-- ============================================================
-- Migration: 002_rls_policies
-- Description: Row Level Security + safe public views.
--
-- Read access is open on all tables (tokens are stripped via
-- views). All writes go through RPC functions only —
-- direct inserts/updates are blocked at the RLS layer.
-- ============================================================

-- Enable RLS on every table
alter table public.players            enable row level security;
alter table public.rooms              enable row level security;
alter table public.room_members       enable row level security;
alter table public.weekly_claims      enable row level security;
alter table public.predictions        enable row level security;
alter table public.prediction_options enable row level security;
alter table public.bets               enable row level security;

-- ============================================================
-- PLAYERS — globally readable, token stripped via view
-- ============================================================
create policy "players_select"
  on public.players for select using (true);

create policy "players_no_direct_write"
  on public.players for insert with check (false);

create policy "players_no_direct_update"
  on public.players for update using (false);

-- ============================================================
-- ROOMS — globally readable, organizer_token stripped via view
-- ============================================================
create policy "rooms_select"
  on public.rooms for select using (true);

create policy "rooms_no_direct_write"
  on public.rooms for insert with check (false);

create policy "rooms_no_direct_update"
  on public.rooms for update using (false);

-- ============================================================
-- ROOM_MEMBERS — readable by anyone (leaderboards, player lists)
-- ============================================================
create policy "room_members_select"
  on public.room_members for select using (true);

create policy "room_members_no_direct_write"
  on public.room_members for insert with check (false);

create policy "room_members_no_direct_update"
  on public.room_members for update using (false);

-- ============================================================
-- WEEKLY CLAIMS — readable by anyone (streak display)
-- ============================================================
create policy "weekly_claims_select"
  on public.weekly_claims for select using (true);

create policy "weekly_claims_no_direct_write"
  on public.weekly_claims for insert with check (false);

-- ============================================================
-- PREDICTIONS — readable by anyone
-- ============================================================
create policy "predictions_select"
  on public.predictions for select using (true);

create policy "predictions_no_direct_write"
  on public.predictions for insert with check (false);

create policy "predictions_no_direct_update"
  on public.predictions for update using (false);

-- ============================================================
-- PREDICTION OPTIONS — readable by anyone
-- ============================================================
create policy "prediction_options_select"
  on public.prediction_options for select using (true);

create policy "prediction_options_no_direct_write"
  on public.prediction_options for insert with check (false);

-- ============================================================
-- BETS — readable by anyone, visibility gated via view
-- ============================================================
create policy "bets_select"
  on public.bets for select using (true);

create policy "bets_no_direct_write"
  on public.bets for insert with check (false);

create policy "bets_no_direct_update"
  on public.bets for update using (false);

-- ============================================================
-- SAFE VIEWS
-- These are the surfaces the frontend queries directly.
-- Sensitive columns (player_token, organizer_token) are
-- never included.
-- ============================================================

-- Global player profile — no token
create or replace view public.players_public as
  select
    id,
    username,
    points_balance,
    points_in_escrow,
    (points_balance - points_in_escrow) as points_available,
    total_won,
    current_streak,
    longest_streak,
    last_claim_at,
    created_at
  from public.players;

comment on view public.players_public is
  'Global player profile. Token-free. Used for profile lookups and global leaderboard.';

-- Room without organizer_token
create or replace view public.rooms_public as
  select id, room_code, name, status, created_at
  from public.rooms;

comment on view public.rooms_public is
  'Room details without the sensitive organizer_token.';

-- Room membership enriched with player username + per-room stats.
-- Primary surface for room leaderboards and player lists.
create or replace view public.room_members_public as
  select
    rm.id,
    rm.room_id,
    rm.player_id,
    p.username,
    rm.is_organizer,
    rm.total_won_in_room,
    p.points_balance,
    p.points_in_escrow,
    (p.points_balance - p.points_in_escrow) as points_available,
    p.total_won        as total_won_global,
    p.current_streak,
    p.longest_streak,
    p.last_claim_at,
    rm.joined_at
  from public.room_members rm
  join public.players p on p.id = rm.player_id;

comment on view public.room_members_public is
  'Room membership enriched with player data. Used for room leaderboards and player lists. No tokens exposed.';

-- Bets with phase-gated visibility:
--   draft   → option_id and amount are null (hide individual positions)
--   locked+ → fully visible
create or replace view public.bets_visible as
  select
    b.id,
    b.prediction_id,
    b.player_id,
    pl.username,
    case when pred.status = 'draft' then null else b.option_id end as option_id,
    case when pred.status = 'draft' then null else b.amount    end as amount,
    b.payout,
    b.placed_at,
    b.updated_at,
    pred.status as prediction_status
  from public.bets b
  join public.predictions pred on pred.id = b.prediction_id
  join public.players      pl  on pl.id   = b.player_id;

comment on view public.bets_visible is
  'Bets with phase-gated visibility. option_id and amount are null during draft to prevent information advantage.';
