-- Owner only. Makes a member an organizer, resolver or plain member.
-- Ownership moves with transfer_ownership, never here.
create or replace function public.set_member_role(
  p_room_id   uuid,
  p_player_id uuid,
  p_role      text
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id uuid;
  v_target    public.room_members%rowtype;
begin
  v_player_id := private.get_player_id_from_auth();

  if v_player_id is null then
    raise exception 'Player profile not found. Please complete registration.' using errcode = 'P0004';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and player_id = v_player_id
      and role = 'owner'
  ) then
    raise exception 'Only the room owner can change roles' using errcode = 'P0012';
  end if;

  if p_role is null or p_role not in ('organizer', 'resolver', 'member') then
    raise exception 'Role must be organizer, resolver or member' using errcode = 'P0001';
  end if;

  select * into v_target
  from public.room_members
  where room_id = p_room_id
    and player_id = p_player_id
  for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  if v_target.role = 'owner' then
    raise exception 'The owner''s role can''t be changed. Transfer ownership instead.' using errcode = 'P0001';
  end if;

  update public.room_members
  set role = p_role
  where id = v_target.id;

  return json_build_object('player_id', p_player_id, 'role', p_role);
end;
$$;
