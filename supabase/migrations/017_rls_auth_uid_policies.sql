-- ============================================================
-- Migration: 017_rls_auth_uid_policies
-- Description:
--   Grant SELECT privileges to authenticated role on game tables
--   (matching existing anon grants from migration 005).
--   Add RLS policies allowing authenticated users to read their
--   own preference and push-subscription rows.
--   Add a policy allowing players to update their own row.
-- ============================================================

-- ============================================================
-- 1. GRANT SELECT ON GAME TABLES TO authenticated ROLE
--    Mirrors the column-level grants already given to anon.
-- ============================================================

grant select (
  id, username, points_balance, points_in_escrow,
  total_won, current_streak, longest_streak, last_claim_at, created_at
) on public.players to authenticated;

grant select (
  id, room_code, name, status, created_at
) on public.rooms to authenticated;

grant select (
  id, room_id, player_id, is_organizer, total_won_in_room, joined_at
) on public.room_members to authenticated;

grant select (
  id, player_id, week_key, claimed_at
) on public.weekly_claims to authenticated;

grant select (
  id, room_id, created_by, title, status, deadline,
  winning_option_id, resolved_at, created_at
) on public.predictions to authenticated;

grant select (
  id, prediction_id, label, display_order, total_bet, created_at
) on public.prediction_options to authenticated;

grant select (
  id, prediction_id, player_id, option_id, amount, payout, placed_at, updated_at
) on public.bets to authenticated;

-- ============================================================
-- 2. players: allow player to update their own row via auth
-- ============================================================

drop policy if exists "players_self_update" on public.players;
create policy "players_self_update"
  on public.players for update
  using (user_id = auth.uid());

-- ============================================================
-- 3. player_preferences: authenticated users can read their own
-- ============================================================

grant select on public.player_preferences to authenticated;

drop policy if exists "player_preferences_no_direct_select" on public.player_preferences;
create policy "player_preferences_select_own"
  on public.player_preferences for select
  using (player_id = private.get_player_id_from_auth());

-- ============================================================
-- 4. room_preferences: authenticated users can read their own
-- ============================================================

grant select on public.room_preferences to authenticated;

drop policy if exists "room_preferences_no_direct_select" on public.room_preferences;
create policy "room_preferences_select_own"
  on public.room_preferences for select
  using (player_id = private.get_player_id_from_auth());

-- ============================================================
-- 5. user_push_subscriptions: authenticated users read their own
-- ============================================================

grant select on public.user_push_subscriptions to authenticated;

drop policy if exists "user_push_subscriptions_no_direct_select" on public.user_push_subscriptions;
create policy "user_push_subscriptions_select_own"
  on public.user_push_subscriptions for select
  using (user_id = private.get_player_id_from_auth());
