create or replace function public.get_player(
  p_player_token text
)
returns json
language plpgsql
security definer
as $$
declare
  v_player public.players;
begin
  select *
  into v_player
  from public.players
  where player_token = p_player_token;

  if not found then
    raise exception 'Invalid player token'
    using errcode = 'P0001';
  end if;

  return json_build_object(
    'id', v_player.id,
    'username', v_player.username,
    'points_in_escrow', v_player.points_in_escrow,
    'points_balance', v_player.points_balance,
    'total_won', v_player.total_won,
    'current_streak', v_player.current_streak,
    'longest_streak', v_player.longest_streak,
    'last_claim_at', v_player.last_claim_at
  );
end;
$$;