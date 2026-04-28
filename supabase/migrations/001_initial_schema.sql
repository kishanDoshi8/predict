-- ============================================================
-- Migration: 001_initial_schema
-- Description: Core tables for Predikt
--
-- Player identity is global. A player joins rooms via the
-- room_members join table, which carries per-room stats.
-- Points and weekly claims live on the global player.
-- ============================================================

create extension if not exists "pgcrypto";

-- Private schema for internal helper functions.
-- Not exposed via the PostgREST API (only public schema is exposed).
create schema if not exists private;

-- ============================================================
-- PLAYERS — global identity, one record per person
-- ============================================================
create table public.players (
  id               uuid primary key default gen_random_uuid(),
  username         text not null,
  player_token     text not null unique,            -- secret stored in localStorage
  points_balance   integer not null default 0
                     check (points_balance >= 0),
  points_in_escrow integer not null default 0
                     check (points_in_escrow >= 0),
  total_won        integer not null default 0,      -- global lifetime winnings
  current_streak   integer not null default 0,      -- global weekly claim streak
  longest_streak   integer not null default 0,
  last_claim_at    timestamptz,
  created_at       timestamptz not null default now(),

  -- Username is a global unique handle
  unique (username)
);

comment on table public.players is 'Global player identity. One record per person across all rooms. Username is a permanent global handle.';
comment on column public.players.points_balance is 'Global wallet. +100 per week on claim. Shared across all rooms the player is in.';
comment on column public.players.points_in_escrow is 'Sum of all active bets across all rooms. Freed on bet cancel, prediction resolve, or refund.';
comment on column public.players.total_won is 'Global lifetime winnings across all rooms. Never decremented.';
comment on column public.players.current_streak is 'Consecutive ISO weeks the player has claimed their weekly points.';

create index idx_players_total_won on public.players(total_won desc);
create index idx_players_username  on public.players(lower(username));

-- ============================================================
-- ROOMS
-- ============================================================
create table public.rooms (
  id              uuid primary key default gen_random_uuid(),
  room_code       text not null unique,             -- 6-char join code e.g. XK9F2A
  name            text not null,
  organizer_token text not null unique,             -- secret stored in organizer's localStorage
  status          text not null default 'active'
                    check (status in ('active', 'closed')),
  created_at      timestamptz not null default now()
);

comment on table public.rooms is 'Private prediction rooms. Joined via room_code. Organizer identified by organizer_token.';
comment on column public.rooms.organizer_token is 'Secret token — never exposed in client queries. Validated only inside RPC functions.';

-- ============================================================
-- ROOM_MEMBERS — join table linking global players to rooms
-- Carries per-room stats for room-scoped leaderboards
-- ============================================================
create table public.room_members (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references public.rooms(id) on delete cascade,
  player_id           uuid not null references public.players(id) on delete cascade,
  is_organizer        boolean not null default false,
  total_won_in_room   integer not null default 0,   -- winnings scoped to this room only
  joined_at           timestamptz not null default now(),

  -- One membership record per player per room
  unique (room_id, player_id)
);

comment on table public.room_members is 'Links global players to rooms. Carries per-room stats used for room-scoped leaderboards.';
comment on column public.room_members.is_organizer is 'True for the player who created the room. Exactly one organizer per room.';
comment on column public.room_members.total_won_in_room is 'Points won inside this specific room. Used for the room leaderboard.';

create index idx_room_members_room_id      on public.room_members(room_id);
create index idx_room_members_player_id    on public.room_members(player_id);
create index idx_room_members_leaderboard  on public.room_members(room_id, total_won_in_room desc);

-- ============================================================
-- WEEKLY CLAIMS — global, one per player per ISO week
-- ============================================================
create table public.weekly_claims (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  week_key     text not null,                       -- ISO week e.g. '2025-W04'
  auto_claimed boolean not null default false,
  claimed_at   timestamptz not null default now(),

  -- One claim per player per week globally — not per room
  unique (player_id, week_key)
);

comment on table public.weekly_claims is 'One global claim per player per ISO week. Awards +100 to global wallet regardless of how many rooms the player is in.';
comment on column public.weekly_claims.week_key is 'ISO year + week e.g. 2025-W04. Computed server-side to prevent timezone abuse.';

-- ============================================================
-- PREDICTIONS
-- ============================================================
create table public.predictions (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid not null references public.rooms(id) on delete cascade,
  created_by        uuid not null references public.players(id),
  title             text not null,
  status            text not null default 'draft'
                      check (status in ('draft', 'locked', 'revealed', 'cancelled', 'no_result')),
  deadline          timestamptz not null,
  winning_option_id uuid,                           -- FK added after prediction_options exists
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

comment on table public.predictions is 'One active prediction per room at a time (enforced in RPC). Lifecycle: draft → locked → revealed / no_result / cancelled.';

create index idx_predictions_room_status on public.predictions(room_id, status);

-- ============================================================
-- PREDICTION OPTIONS
-- ============================================================
create table public.prediction_options (
  id            uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.predictions(id) on delete cascade,
  label         text not null,
  display_order smallint not null default 0,
  total_bet     integer not null default 0
                  check (total_bet >= 0),           -- cached aggregate, updated on each bet
  created_at    timestamptz not null default now()
);

comment on table public.prediction_options is '2–6 options per prediction (enforced in RPC). total_bet is a cached sum for fast pool display via Realtime.';

-- Add FK back to predictions now that prediction_options exists
alter table public.predictions
  add constraint fk_predictions_winning_option
  foreign key (winning_option_id) references public.prediction_options(id);

-- ============================================================
-- BETS
-- ============================================================
create table public.bets (
  id            uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.predictions(id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  option_id     uuid not null references public.prediction_options(id) on delete cascade,
  amount        integer not null
                  check (amount >= 1),
  payout        integer,                            -- null until resolved
  placed_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- One active bet per player per prediction
  unique (prediction_id, player_id)
);

comment on table public.bets is 'One bet per player per prediction. Updatable during draft. Escrow held in players.points_in_escrow.';

create index idx_bets_prediction_option on public.bets(prediction_id, option_id);
create index idx_bets_player            on public.bets(player_id);
