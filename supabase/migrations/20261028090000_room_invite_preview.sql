-- ============================================================
-- Migration: room_invite_preview
-- Description: Pasted invite links show the room's name and counts. The
--   invite-preview edge function reads them with the service key.
-- ============================================================

-- What a pasted invite link may show before anyone signs in: the room's name
-- and counts only, never member names or questions. Called by the
-- invite-preview edge function with the service key; players can't call it.
create or replace function public.get_room_invite_preview(
  p_room_code text
)
returns json
language sql
stable
security definer
set search_path = public, private
as $$
  select json_build_object(
    'name', r.name,
    'room_code', r.room_code,
    'member_count', (
      select count(*)::int from public.room_members rm where rm.room_id = r.id
    ),
    'active_prediction_count', (
      select count(*)::int
      from public.predictions p
      where p.room_id = r.id and p.status in ('draft', 'locked')
    ),
    'series_title', (
      select s.title
      from public.series s
      where s.room_id = r.id and s.status = 'active'
      order by s.created_at desc
      limit 1
    )
  )
  from public.rooms r
  where r.room_code = upper(trim(p_room_code))
    and r.status = 'active';
$$;

revoke execute on function public.get_room_invite_preview(text) from public, anon, authenticated;
grant execute on function public.get_room_invite_preview(text) to service_role;
