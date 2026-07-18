create or replace function public.get_room_series(
  p_room_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_active json;
  v_completed json;
  v_archived json;
  v_draft json;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = v_player_id
  ) then
    raise exception 'Room member not found' using errcode = 'P0011';
  end if;

  select coalesce(json_agg(s.* order by s.started_at desc nulls last, s.created_at desc), '[]'::json)
    into v_active
  from public.series s
  where s.room_id = p_room_id
    and s.status = 'active';

  select coalesce(json_agg(s.* order by s.completed_at desc nulls last, s.created_at desc), '[]'::json)
    into v_completed
  from public.series s
  where s.room_id = p_room_id
    and s.status = 'completed';

  select coalesce(json_agg(s.* order by s.archived_at desc nulls last, s.created_at desc), '[]'::json)
    into v_archived
  from public.series s
  where s.room_id = p_room_id
    and s.status = 'archived';

  select coalesce(json_agg(s.* order by s.created_at desc), '[]'::json)
    into v_draft
  from public.series s
  where s.room_id = p_room_id
    and s.status = 'draft';

  return json_build_object(
    'draft', v_draft,
    'active', v_active,
    'completed', v_completed,
    'archived', v_archived
  );
end;
$$;
