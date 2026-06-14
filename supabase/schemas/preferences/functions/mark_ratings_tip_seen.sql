create or replace function public.mark_ratings_tip_seen()
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
    raise exception 'Player profile not found' using errcode = 'P0004';
  end if;

  insert into public.player_preferences (player_id, has_seen_ratings_tip)
  values (v_player_id, true)
  on conflict (player_id) do update
    set has_seen_ratings_tip = true,
        updated_at = now();
end;
$$;
