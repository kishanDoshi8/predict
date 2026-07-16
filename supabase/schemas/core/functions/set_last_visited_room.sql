create or replace function public.set_last_visited_room(
  p_room_id uuid
)
returns void
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

  update public.players p
  set last_visited_room_id = p_room_id
  where p.id = v_player_id
    and exists (
      select 1
      from public.rooms r
      join public.room_members rm on rm.room_id = r.id
      where r.id = p_room_id
        and r.status = 'active'
        and rm.player_id = v_player_id
    );
end;
$$;
