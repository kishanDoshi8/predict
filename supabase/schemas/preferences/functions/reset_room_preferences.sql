create or replace function public.reset_room_preferences(
  p_room_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_is_member boolean;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and player_id = v_player_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'Access denied: you are not a member of this room' using errcode = 'P0011';
  end if;

  delete from public.room_preferences
  where room_id = p_room_id and player_id = v_player_id;

  return public.get_preferences(p_room_id);
end;
$$;
