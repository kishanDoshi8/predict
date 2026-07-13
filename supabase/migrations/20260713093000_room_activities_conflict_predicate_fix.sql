-- ============================================================
-- Migration: room_activities_conflict_predicate_fix
-- Description: Align ON CONFLICT target with partial unique index predicate.
-- ============================================================

create or replace function private.create_room_activity(
  p_room_id uuid,
  p_activity_type text,
  p_activity_tier smallint,
  p_metadata jsonb default '{}'::jsonb,
  p_click_action jsonb default null,
  p_created_by_player_id uuid default null,
  p_dedupe_key text default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.room_activities (
    room_id,
    activity_type,
    activity_tier,
    metadata,
    click_action,
    created_by_player_id,
    dedupe_key
  )
  values (
    p_room_id,
    p_activity_type,
    p_activity_tier,
    coalesce(p_metadata, '{}'::jsonb),
    p_click_action,
    p_created_by_player_id,
    p_dedupe_key
  )
  on conflict (room_id, dedupe_key)
  where dedupe_key is not null
  do nothing;
end;
$$;