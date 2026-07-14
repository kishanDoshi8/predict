-- ============================================================
-- Migration: create_room_activity_integer_compat
-- Description: Add integer-tier overload for private.create_room_activity
--              to support existing call sites that pass integer literals.
-- ============================================================

create or replace function private.create_room_activity(
  p_room_id uuid,
  p_activity_type text,
  p_activity_tier integer,
  p_metadata jsonb default '{}'::jsonb,
  p_click_action jsonb default null,
  p_created_by_player_id uuid default null,
  p_dedupe_key text default null
)
returns void
language sql
security definer
set search_path = public, private
as $$
  select private.create_room_activity(
    p_room_id := p_room_id,
    p_activity_type := p_activity_type,
    p_activity_tier := p_activity_tier::smallint,
    p_metadata := p_metadata,
    p_click_action := p_click_action,
    p_created_by_player_id := p_created_by_player_id,
    p_dedupe_key := p_dedupe_key
  );
$$;

revoke all on function private.create_room_activity(uuid, text, integer, jsonb, jsonb, uuid, text) from public;
revoke all on function private.create_room_activity(uuid, text, integer, jsonb, jsonb, uuid, text) from authenticated;