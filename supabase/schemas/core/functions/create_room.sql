create or replace function public.create_room(
  p_room_name text
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_room      public.rooms%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if length(trim(p_room_name)) = 0 then
    raise exception 'Room name cannot be empty' using errcode = 'P0001';
  end if;

  insert into public.rooms (name, room_code)
  values (trim(p_room_name), private.generate_room_code())
  returning * into v_room;

  insert into public.room_members (room_id, player_id, is_organizer)
  values (v_room.id, v_player_id, true);

  return json_build_object(
    'id',         v_room.id,
    'code',       v_room.room_code,
    'name',       v_room.name,
    'status',     v_room.status,
    'player_id',  v_player_id,
    'created_at', v_room.created_at
  );
end;
$$;
