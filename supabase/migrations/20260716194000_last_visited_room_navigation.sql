alter table public.players
add column if not exists last_visited_room_id uuid references public.rooms(id) on delete set null;

create index if not exists idx_players_last_visited_room_id
on public.players(last_visited_room_id);

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

grant execute on function public.set_last_visited_room(uuid) to authenticated;
