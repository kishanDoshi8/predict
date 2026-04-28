-- ============================================================
-- Seed: Local dev data
-- Run after migrations to get a working dev environment
-- Usage: supabase db reset (runs migrations + seed automatically)
-- ============================================================

-- Create a test room
select public.create_room('Dev Room', 'organizer');

-- The above returns tokens — copy them from the output and use
-- them in your .env.local or browser localStorage for testing.
--
-- To manually inspect after running:
--   select id, room_code, organizer_token from public.rooms;
--   select id, username, player_token from public.players;
