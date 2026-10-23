-- Used by RLS policies: true for the caller's own player and anyone they share a room with.
create or replace function private.shares_room_with(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_player_id = private.get_player_id_from_auth()
    or exists (
      select 1
      from public.room_members me
      join public.room_members them on them.room_id = me.room_id
      where me.player_id = private.get_player_id_from_auth()
        and them.player_id = p_player_id
    );
$$;
