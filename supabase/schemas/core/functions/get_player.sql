create or replace function public.get_player()
returns json
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player public.players%rowtype;
begin
  select * into v_player
  from public.players
  where user_id = auth.uid();

  if not found then
    raise exception 'Player profile not found' using errcode = 'P0001';
  end if;

  return json_build_object(
    'id',                   v_player.id,
    'username',             v_player.username,
    'points_in_escrow',     v_player.points_in_escrow,
    'points_balance',       v_player.points_balance,
    'total_won',            v_player.total_won,
    'current_streak',       v_player.current_streak,
    'longest_streak',       v_player.longest_streak,
    'last_claim_at',        v_player.last_claim_at,
    'last_visited_room_id', v_player.last_visited_room_id
  );
end;
$$;
