-- Owner only. The new owner takes over; the old owner stays on as an organizer.
create or replace function public.transfer_ownership(
  p_room_id   uuid,
  p_player_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  perform 1
  from public.room_members
  where room_id = p_room_id
    and player_id = v_player_id
    and role = 'owner'
  for update;

  if not found then
    raise exception 'Only the room owner can transfer ownership' using errcode = 'P0012';
  end if;

  if p_player_id = v_player_id then
    raise exception 'You already own this room' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and player_id = p_player_id
  ) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  -- Step down first: a room has exactly one owner at any moment.
  update public.room_members
  set role = 'organizer'
  where room_id = p_room_id and player_id = v_player_id;

  update public.room_members
  set role = 'owner'
  where room_id = p_room_id and player_id = p_player_id;

  return json_build_object('owner_id', p_player_id, 'previous_owner_id', v_player_id);
end;
$$;
