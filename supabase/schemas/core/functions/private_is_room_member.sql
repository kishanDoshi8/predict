-- Used by RLS policies. Security definer so policies on room_members can call it without recursing.
create or replace function private.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.player_id = private.get_player_id_from_auth()
  );
$$;
