-- ============================================================
-- Migration: 015_supabase_auth_link_players
-- Description:
--   Link public.players to auth.users to enable Supabase Auth.
--   Adds user_id column and a private helper for resolving the
--   current player from the JWT auth context (auth.uid()).
-- ============================================================

-- Add user_id column linking players to Supabase auth users
alter table public.players
  add column if not exists user_id uuid unique references auth.users(id) on delete cascade;

create index if not exists idx_players_user_id on public.players(user_id);

comment on column public.players.user_id is
  'Links player to Supabase auth.users. Null for legacy players created before the auth migration.';

-- ============================================================
-- HELPER: resolve player_id from the JWT auth context
-- Returns NULL when no player profile exists for the caller.
-- ============================================================

create or replace function private.get_player_id_from_auth()
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select id from public.players where user_id = auth.uid() limit 1;
$$;

comment on function private.get_player_id_from_auth() is
  'Returns the players.id for the currently authenticated Supabase user, or NULL if no player profile exists.';
