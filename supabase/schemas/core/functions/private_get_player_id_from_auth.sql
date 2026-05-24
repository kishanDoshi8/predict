create or replace function private.get_player_id_from_auth()
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select id from public.players where user_id = auth.uid() limit 1;
$$;
