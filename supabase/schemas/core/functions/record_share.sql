create or replace function public.record_share(
  p_room_id uuid,
  p_kind text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_kind text := lower(trim(p_kind));
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null or not private.is_room_member(p_room_id) then
    raise exception 'Only room members can share from this room' using errcode = 'P0013';
  end if;

  if v_kind is null or v_kind !~ '^[a-z][a-z-]{0,31}$' then
    raise exception 'Unknown share kind' using errcode = 'P0001';
  end if;

  insert into public.share_events (room_id, player_id, kind)
  values (p_room_id, v_player_id, v_kind);
end;
$$;
