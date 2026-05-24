create or replace function public.register_player(
  p_username text
)
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player public.players%rowtype;
  v_uid    uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'P0004';
  end if;

  if length(trim(p_username)) < 2 then
    raise exception 'Username must be at least 2 characters' using errcode = 'P0001';
  end if;

  -- Return existing profile if already registered
  select * into v_player
  from public.players
  where user_id = v_uid;

  if found then
    return json_build_object(
      'player_id', v_player.id,
      'username',  v_player.username
    );
  end if;

  -- Check username not already taken globally
  if exists (
    select 1 from public.players
    where lower(username) = lower(trim(p_username))
  ) then
    raise exception 'Username is already taken' using errcode = 'P0003';
  end if;

  insert into public.players (username, user_id, player_token)
  values (trim(p_username), v_uid, private.generate_token())
  returning * into v_player;

  return json_build_object(
    'player_id', v_player.id,
    'username',  v_player.username
  );
end;
$$;
